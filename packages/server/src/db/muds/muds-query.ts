/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Thu May 31 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as DsEntity                    from '@google-cloud/datastore/entity'
import * as lo                          from 'lodash'

import {  Query as DsQuery, 
          QueryResult 
            as DsQueryResult }          from '@google-cloud/datastore/query'
import {  DatastoreTransaction 
            as DSTransaction }          from '@google-cloud/datastore/transaction'
         

import {  RunContextServer  }           from '../../rc-server'
import {  Mubble }                      from '@mubble/core'
import {  MeField,         
          MudsEntityInfo }              from './muds-manager'

import {  Muds, 
          DatastoreInt, 
          DsRec }                       from './muds'

import {  MudsBaseEntity, 
          MudsBaseStruct, 
          FieldAccessor}              from './muds-base-entity'
import { MudsIo } from './muds-io';

export type Comparator = '=' | '>' | '>=' | '<' | '<='

interface FilterOps {
  fieldName   : string
  comparator  : Comparator
  value       : any
}

interface OrderOps {
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

enum Criteria {
  selects = 'selects', 
  groupBys = 'groupBys', 
  filters = 'filters', 
  orders = 'orders'
}

const arCriteria = Object.keys(Criteria)

export class MudsQuery<T extends MudsBaseEntity> {

  private readonly entityInfo   : MudsEntityInfo
  private readonly filters      : FilterOps[]     = []
  private readonly orders       : OrderOps[]      = []
  private readonly selects      : string[]        = []
  private readonly groupBys     : string[]        = []

  private result: MudsQueryResult<T>

  constructor(private rc            : RunContextServer, 
              private io            : MudsIo,
              private ancestorKeys  : DsEntity.DatastoreKey | null,
              private entityClass   : Muds.IBaseEntity<T>
            ) {

    const entityInfo = this.entityInfo = io.getInfo(entityClass)
  }

  public select(fieldName: keyof T | KEY) {

    const rc          = this.rc,
          entityName  = this.entityInfo.entityName

    this.verifyStatusAndFieldName(fieldName as string)
    this.verifyCriterion(Criteria.selects)

    rc.isAssert() && rc.assert(rc.getName(this), !this.groupBys.length, 
    `${entityName}/${fieldName} you cannt use select when group-by is given`)

    this.selects.push(fieldName as string)
    return this
  }

  public groupBy(fieldName: keyof T | KEY) {

    const rc          = this.rc,
          entityName  = this.entityInfo.entityName

    this.verifyStatusAndFieldName(fieldName as string)
    this.verifyCriterion(Criteria.groupBys)
      
    rc.isAssert() && rc.assert(rc.getName(this), !this.selects.length, 
      `${entityName}/${fieldName} you cannt use group when select clause is given`)

    this.groupBys.push(fieldName as string)
    return this
  }

  public filter(fieldName: keyof T | KEY | string, comparator: Comparator, value: any): MudsQuery<T> {

    const rc          = this.rc,
          entityName  = this.entityInfo.entityName

    this.verifyStatusAndFieldName(fieldName as string)
    this.verifyCriterion(Criteria.filters)

    this.selects.indexOf(fieldName as string) !== -1 && rc.isAssert() && rc.assert(rc.getName(this), 
      comparator !== '=', `A 'select'ed field ${entityName}/${fieldName} cannot be filtered for equality`)

    for (const filter of this.filters) {
      if (filter.fieldName === fieldName) {

        rc.isAssert() && rc.assert(rc.getName(this), comparator !== '=' && filter.comparator !== '=', 
          `${entityName}/${fieldName} is being filtered twice with equality`)

        if (comparator === '>' || comparator === '>=')  rc.isAssert() && 
          rc.assert(rc.getName(this), (filter.comparator === '<' || filter.comparator === '<=')  , 
          `${entityName}/${fieldName} mismatched comparators ${filter.comparator} and ${comparator}`)

        if (comparator === '<' || comparator === '<=')  rc.isAssert() && 
          rc.assert(rc.getName(this), (filter.comparator === '>' || filter.comparator === '>=')  , 
          `${entityName}/${fieldName} mismatched comparators ${filter.comparator} and ${comparator}`)

      } else if (comparator !== '=') {
        rc.isAssert() && rc.assert(rc.getName(this), filter.comparator === '=', 
        `${entityName}/${fieldName} only one field with inequality filter. 
          You also have it on ${filter.fieldName}`)
      }
    }

    const meField = this.io.getReferredField(rc, fieldName as string, this.entityInfo.entityName) as MeField
    meField.accessor.validateType(value)
    //TODO:( Review this code)
    if (meField.fieldType === Array) { 
      value = value.toString()
    }
    this.filters.push({fieldName : fieldName as string, comparator, value})
    return this
  }

  public order(fieldName: keyof T | KEY, ascending: boolean = true) {

    const rc          = this.rc,
          entityName  = this.entityInfo.entityName

    this.verifyStatusAndFieldName(fieldName as string)
    this.verifyCriterion(Criteria.orders)

    if (!this.orders.length) {
      const ineqFilter = this.filters.find(item => item.comparator !== '=')
      ineqFilter && rc.isAssert() && rc.assert(rc.getName(this), ineqFilter.fieldName === fieldName,
      `${entityName}/${fieldName} first order field must be with ineq filter: (${ineqFilter.fieldName})`)
    }

    this.verifyStatusAndFieldName(fieldName as string)

    for (const filter of this.filters) {
      rc.isAssert() && rc.assert(rc.getName(this), 
        filter.fieldName === fieldName && filter.comparator === '=', 
        `${entityName}/${fieldName} cannot order on field with equality filter`)
    }

    this.orders.push({fieldName : fieldName as string, ascending})
    return this
  }

  private verifyCriterion(criterion: Criteria) {

    const thisObj = this as any,
          rc      = this.rc

    for (let index = arCriteria.length - 1; index >= 0; index--) {
      const item = arCriteria[index]
      if (item === criterion) return
      rc.isAssert() && rc.assert(rc.getName(this), thisObj[item].length === 0, 
      `'${criterion}' cannot be specified after '${item}'`)
    }      
  }

  private verifyStatusAndFieldName(fieldName: string) {

    const rc          = this.rc,
          entityName  = this.entityInfo.entityName

    rc.isAssert() && rc.assert(rc.getName(this), !this.result, 'Query closed for edit')

    if (fieldName !== KEY) {
      this.io.checkIndexed(this.rc, fieldName, entityName)
    }
  }

  public async runBasedOnMultipleKeys(keys : string[] | number[]) : 
                                      Promise<MudsQueryResult<T>> {

    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), keys.length != 0, 
      `runBasedOnMultipleKeys keys should not be empty : ${keys}`)

    const dsQuery = this.io.createQuery(this.entityInfo.entityName),
          res     = await this.io.getEntityBasedOnKeys(this.entityInfo, keys)

    this.result =  new MudsQueryResult(this.rc, this.io, this.entityClass, 
          dsQuery, keys.length, res, false)
    return this.result
  }

  public async run(limit: number) {
    const rc = this.rc
    this.result && rc.isAssert() && rc.assert(rc.getName(this), false, 'Query cannot run again')
    const dsQuery = this.io.createQuery(this.entityInfo.entityName)
    if (this.ancestorKeys) dsQuery.hasAncestor(this.ancestorKeys)

    for (const fieldName of this.selects)   dsQuery.select(fieldName)
    for (const fieldName of this.groupBys)  dsQuery.groupBy(fieldName)

    for (const filter of this.filters)      dsQuery.filter(filter.fieldName, 
      filter.comparator, filter.value)
    for (const order of this.orders)        dsQuery.order(order.fieldName, 
      order.ascending ? undefined : {descending: true})

    dsQuery.limit(limit)
    this.result = new MudsQueryResult(rc, this.io, this.entityClass, 
                    dsQuery, limit, await dsQuery.run(), 
                    !!(this.filters.length || this.groupBys.length))
    return this.result          
  }
}

/* ---------------------------------------------------------------------------
  MudsQueryResult
-----------------------------------------------------------------------------*/
export class MudsQueryResult<T extends MudsBaseEntity> implements AsyncIterable<T> {

  private records   : T[]
  private endCursor : string
  private hasMore   : boolean

  // This is short term till we get upgrade to 'for await' 
  private iterator  : { next : () => Promise<IteratorResult<T>> } | null

  constructor(private rc      : RunContextServer, 
    private io                : MudsIo,
    private entityClass       : Muds.IBaseEntity<T>,
    private dsQuery           : DsQuery,
    private limit             : number,
            result            : DsQueryResult,
    private onlySelectedCols  : boolean) {
    this.loadData(result)
  }

  private loadData(result: DsQueryResult) {

    const [ar, info]  = result
    this.records      = ar as T[]

    if (ar.length) {
      this.endCursor    = info.endCursor || ''
      this.hasMore      = (info.moreResults !== 'NO_MORE_RESULTS')
    } else {
      this.endCursor    = ''
      this.hasMore      = false
    }

    // ???? checkEmulator()
    if (this.hasMore && ar.length < this.limit) this.hasMore = false

    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'Got query result', {
      count: this.records.length, hasMore: this.hasMore, moreResults: info.moreResults
    })

    //console.log('endCursor', this.endCursor)
  }

  public getCurrentRecs(): T[] {

    const entities = []
    for (const rec of this.records) {
      entities.push(this.io.getRecordFromDs(this.rc, this.entityClass, rec, !this.onlySelectedCols))
    }
    return entities
  }

  // for future when we move to v8 6.3
  public [Symbol.asyncIterator]() : AsyncIterator<T> {
    let ptr = 0 
    return {
      next : async () : Promise<IteratorResult<T>> => {

        if (ptr === this.records.length) {
          if (this.hasMore) {
            this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 'Fetching more data')
            this.dsQuery.start(this.endCursor)
            this.loadData(await this.dsQuery.run())
            ptr = 0
          }
        }

        // TODO : Need to fix next(), should return undefined after done

        const done = !this.hasMore && ptr === this.records.length
        return {
            done,
            value : done ? this.records[ptr - 1]
                         : this.io.getRecordFromDs(this.rc, this.entityClass,
                                                   this.records[ptr++], !this.onlySelectedCols)
        }
      }
    }
  }

  // Delete this function when 'for await' is available
  public async getNext() {
    if (!this.iterator) this.iterator = await this[Symbol.asyncIterator]()
    const result = await this.iterator.next()
    if (result.done) {
      this.iterator = null
      return
    }
    return result.value
  }

  async $dump() {
    let entity 
    while(entity = await this.getNext()) {
      entity.$dump()
    }
  }

}
