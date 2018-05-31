/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Thu May 31 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as Datastore                   from '@google-cloud/datastore'
import * as DsEntity                    from '@google-cloud/datastore/entity'
import { Query as DsQuery }             from '@google-cloud/datastore/query'

import {  GcloudEnv }                   from '../../gcp/gcloud-env'
        
import {  RunContextServer  }           from '../../rc-server'
import * as lo                          from 'lodash'
import { Mubble }                       from '@mubble/core'
import {  MeField,         
          MudsManager,
          DatastorePayload,         
          MudsEntityInfo }              from './muds-manager'
import { Muds, DatastoreInt, DsRec }    from '..'
import { MudsBaseEntity }               from './muds-base-entity';
import { MudsIo }                       from './muds-io'

export type Comparator = '=' | '>' | '>=' | '<' | '<='

interface FilterOps {
  fieldName   : string
  comparator  : Comparator
  value       : any
}

interface SortOps {
  fieldName   : string
  ascending   : boolean
}

export type  KEY = '__key__'
export const KEY = '__key__'

/**
Array properties can be useful, for instance, when performing queries with equality 
filters: an entity satisfies the query if any of its values for a property matches 
the value specified in the filter

Queries on keys use indexes just like queries on properties and require custom 
indexes in the same cases, with a couple of exceptions: inequality filters or 
an ascending sort order on the key do not require a custom index, but a descending 
sort order on the key does.

The rows of an index table are sorted first by ancestor and then by property values, 
in the order specified in the index definition.

	1.	Properties used in equality filters
	2.	Property used in an inequality filter (of which there can be no more than one)
	3.	Properties used in sort orders

If you do not want Cloud Datastore to maintain an index for a property, exclude 
the property from your indexes. Note that excluding a property removes it 
from any composite indexes.

by default, Cloud Datastore automatically predefines two single property indexes 
for each property of each entity kind, one in ascending order and one in descending order.

For more complex queries, an application must define composite, or manual, indexes. 
Composite indexes are required for queries of the following form:
  - Queries with ancestor and inequality filters
  -	Queries with one or more inequality filters on a property and one or more equality 
    filters on other properties
  - Queries with a sort order on keys in descending order
  - Queries with multiple sort orders
  -	Queries with one or more filters and one or more sort orders
  
This is especially worth noting in the case of integers and floating-point numbers, 
which are treated as separate types by Cloud Datastore. Because all integers are 
sorted before all floats, a property with the integer value 38 is sorted 
before one with the floating-point value 37.5.
*/
export class MudsQuery<T extends MudsBaseEntity> {

  private readonly validFields  : string[]        = []
  private readonly entityInfo   : MudsEntityInfo
  private readonly filters      : FilterOps[]     = []
  private readonly sorts        : SortOps[]       = []
  private readonly selects      : string[]        = []

  constructor(protected rc      : RunContextServer, 
              protected manager : MudsManager,
              protected io      : MudsIo,
              entityClass       : Muds.IBaseEntity<T>
            ) {

    const entityInfo = this.entityInfo = manager.getInfo(entityClass)
    for (const fieldName of entityInfo.fieldNames) {
      const meField = entityInfo.fieldMap[fieldName]
      if (meField.indexed) this.validFields.push(fieldName)
    }
  }

  select(fieldName: keyof T | KEY) {

    const rc          = this.rc,
          entityName  = this.entityInfo.entityName

    if (fieldName !== KEY) {
      rc.isAssert() && rc.assert(rc.getName(this), this.validFields.indexOf(fieldName) !== -1, 
        `${entityName} can be queried only by indexed fields. ${fieldName} is not indexed`)
    }

    rc.isAssert() && rc.assert(rc.getName(this), !this.filter.length && !this.sort.length, 
      `${entityName}/${fieldName} add select clause before sort and filter`)

    this.selects.push(fieldName)
    return this
  }

  filter(fieldName: keyof T | KEY, comparator: Comparator, value: any): MudsQuery<T> {

    const rc          = this.rc,
          entityName  = this.entityInfo.entityName

    if (fieldName !== KEY) {
      rc.isAssert() && rc.assert(rc.getName(this), this.validFields.indexOf(fieldName) !== -1, 
        `${entityName} can be queried only by indexed fields. ${fieldName} is not indexed`)
    }

    this.selects.indexOf(fieldName) !== -1 && rc.isAssert() && rc.assert(rc.getName(this), 
      comparator !== '=', `A 'select'ed field ${entityName}/${fieldName} cannot be filtered for equality`)

    rc.isAssert() && rc.assert(rc.getName(this), !this.sort.length, 
      `${entityName}/${fieldName} add filter clause before sort`)

    for (const filter of this.filters) {
      rc.isAssert() && rc.assert(rc.getName(this), 
        filter.fieldName === fieldName && filter.comparator === comparator, 
        `${entityName}/${fieldName} is being filtered twice with same comparator`)

      if (comparator !== '=' && filter.fieldName !== fieldName) {
        rc.isAssert() && rc.assert(rc.getName(this), filter.comparator === '=', 
        `${entityName}/${fieldName} only one field with inequality filter. You also have it on ${filter.fieldName}`)
      }
    }

    this.filters.push({fieldName, comparator, value})
    return this
  }

  sort(fieldName: keyof T | KEY, ascending: boolean = true) {

    const rc          = this.rc,
          entityName  = this.entityInfo.entityName

    if (!this.sorts.length) {
      const ineqFilter = this.filters.find(item => item.comparator !== '=')
      ineqFilter && rc.isAssert() && rc.assert(rc.getName(this), ineqFilter.fieldName === fieldName,
      `${entityName}/${fieldName} first sort field must be with ineq filter: (${ineqFilter.fieldName})`)
    }

    if (fieldName !== KEY) {
      rc.isAssert() && rc.assert(rc.getName(this), this.validFields.indexOf(fieldName) !== -1, 
        `${entityName} can be queried only by indexed fields. ${fieldName} is not indexed`)
    }

    for (const filter of this.filters) {
      rc.isAssert() && rc.assert(rc.getName(this), 
        filter.fieldName === fieldName && filter.comparator === '=', 
        `${entityName}/${fieldName} cannot sort on field with equality filter`)
    }

    this.sorts.push({fieldName, ascending})
    return this
  }

  run(limit ?: number) {
    const dsQuery = this.io.getQuery(this.entityInfo.entityName)
    for (const fieldName of this.selects) dsQuery.select(fieldName)
    for (const filter of this.filters) dsQuery.filter(filter.fieldName, 
      filter.comparator, filter.value)
    for (const sort of this.sorts) dsQuery.order(sort.fieldName, 
      sort.ascending ? undefined : {descending: true})
    if (limit) dsQuery.limit(limit)
  }

}
