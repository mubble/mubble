/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Wed Feb 26 2020
   Author     : Siddharth Garg
   
   Copyright (c) 2020 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { RunContextServer }                 from '../../rc-server'
import { BqRegistryManager, 
         BqFieldInfo 
       }                                    from './bigquery-registry'
import { Mubble }                           from '@mubble/core'

type UnionKeyToValue<U extends string> = {
  [K in U]: K
}

export type BqSeparator = 'AND' | 'OR'
export type BqOperator  = '=' | '!=' | '<' | '>' | '<=' | '>=' | 'IN' | 'LIKE' | 'IS NULL' | 'NOT NULL' | 'BETWEEN'

export type EXTRACT_PART = 'DAYOFWEEK' | 'DAY' | 'DAYOFYEAR' | 'WEEK' | 'ISOWEEK' | 'MONTH' | 'QUARTER' | 'YEAR' | 'ISOYEAR'
export const EXTRACT_PART : UnionKeyToValue<EXTRACT_PART> = {
  DAYOFWEEK : 'DAYOFWEEK',
  DAY       : 'DAY',
  DAYOFYEAR : 'DAYOFYEAR',
  WEEK      : 'WEEK',
  ISOWEEK   : 'ISOWEEK',
  MONTH     : 'MONTH',
  QUARTER   : 'QUARTER',
  YEAR      : 'YEAR',
  ISOYEAR   : 'ISOYEAR'
}

export type QUERY_FIELD_FUNCTION = 'CONVERT_TO_DATE' | 'ROUND' | 'SUM' | 'DISTINCT' | 'COUNT' | 'EXTRACT' | 'CAST_STRING'
export const QUERY_FIELD_FUNCTION : UnionKeyToValue<QUERY_FIELD_FUNCTION> = {
  CONVERT_TO_DATE : 'CONVERT_TO_DATE',
  ROUND           : 'ROUND',
  SUM             : 'SUM',
  DISTINCT        : 'DISTINCT',
  COUNT           : 'COUNT',
  EXTRACT         : 'EXTRACT',
  CAST_STRING     : 'CAST_STRING'
}

export interface BqFieldFunction {
  function : QUERY_FIELD_FUNCTION
  params  ?: Mubble.uObject<string>
}

export interface QueryField {
  name       : string
  functions ?: (BqFieldFunction | QUERY_FIELD_FUNCTION | string)[]
  extract   ?: EXTRACT_PART
  as        ?: string
}

export interface NestedField {
  field      : BqFieldInfo
  functions  : (BqFieldFunction | QUERY_FIELD_FUNCTION | string)[]
  extract   ?: EXTRACT_PART
  as        ?: string
}

export namespace BqQueryBuilder {

    /**
   * @param rc RunContext, used for logging.
   * @param key key or field name.
   * @param value Value(s) of that field.
   * @param operator Conditional operator compatible with Bigquery. By default it is '='.
   * @param upper optional for case insensitive search. By default it is false.
   */
  export function newCondition(rc        : RunContextServer, 
                               key       : string, 
                               value    ?: any, 
                               operator  : BqOperator = '='): string {

    rc.isDebug() && rc.debug(rc.getName(this), 'Creating new condition.', key, value, operator)

    let queryStr : string,
        conds    : Array<any> = []

    if(value instanceof Array) {

      for(const val of value) {
        conds.push(typeof val === 'string' ? `\'${val}\'` : `${val}`)
      }
      
      queryStr = operator === 'BETWEEN' ? `(${key} ${operator} ${conds[0]} AND ${conds[1]})` 
                                        : `(${key} ${operator} (${conds.join(', ')}))`
 
    } else if(value === undefined || value === null) {
      queryStr = `(${key} ${operator})`  
    } else {
      queryStr = `(${key} ${operator} ${typeof value === 'string' ? `\'${value}\'` : value})`                   
    }

    rc.isDebug() && rc.debug(rc.getName(this), 'newCondition', queryStr)
    
    return queryStr
  }

  /**
   * @param rc RunContext, used for logging.
   * @param conditions array of ObmopQueryCondition.
   * @param separator separator to join conditions.
   */
  export function joinConditions(rc          : RunContextServer,
                                 conditions  : Array<string>,
                                 separator   : BqSeparator) : string {

    rc.isDebug() && rc.debug(rc.getName(this), 'joinConditons', conditions, separator)

    if (conditions.length === 0) return ''
    const queryString  = `(${conditions.join(` ${separator} `)})`
    return queryString
  }

  export function query(rc          : RunContextServer, 
                        projectId   : string,
                        table       : string, 
                        fields      : Array<string | QueryField>, 
                        condition  ?: string,
                        orderBy    ?: string[], 
                        groupBy    ?: string[], 
                        limit      ?: number): string {

    const registry     = BqRegistryManager.getRegistry(table),
          regFields    = registry.getFields(),
          nestedFields = {} as any
    
    let select = 'SELECT '
    const from = `FROM \`${projectId}.${registry.getDataset()}.${registry.getTableName()}\``

    for (const fld of fields) {

      // Normalizing to QueryField
      let field : QueryField
      if (typeof fld !== 'string') {
        field = fld
      } else {
        field = {
                  name      : fld,
                  functions : []
                }
      }

      const regField = regFields.find((regField) => regField.name === field.name)

      rc.isAssert() && rc.assert(rc.getName(this), regField, `Field ${field.name} does not exist on schema`)

      if (regField!!.parent) {
        if (!nestedFields[regField!!.parent]) nestedFields[regField!!.parent] = []
        const nestedField : NestedField = {
                                            field     : regField!!,
                                            functions : field.functions || [],
                                            as        : field.as
                                          }
        nestedFields[regField!!.parent].push(nestedField)

      } else {
        let selectField = field.name
        if (field.functions) {
          for (const func of field.functions) {
            selectField = BqQueryHelper.applyBqFunction(selectField, func)
          }  
        }
        select += `${selectField} as ${field.as || field.name}, `
      }
    }

    // For record
    let unnest = ''
    for (const key in nestedFields) {
      unnest += `,UNNEST (${key}) as unnest_${key} ` 
      for (const nestedField of nestedFields[key]) {

        let selectField = `unnest_${key}.${nestedField.field.name}`
        for (const func of nestedField.functions) {
          selectField = BqQueryHelper.applyBqFunction(selectField, func)
        }
        select += `${selectField} as ${nestedField.field.as || nestedField.field.name}, `
      }
    }

    let retval = `${select} ${from} ${unnest}`
    if (condition) retval += `WHERE ${condition} `
    if (groupBy) retval += `GROUP BY ${groupBy} `
    if (orderBy) retval += `ORDER BY ${orderBy} `
    if (limit) retval += `LIMIT ${limit}`

    return retval
  }

  /**
   * Field names are not checked in schema.  
   * Does not support UNNEST
   */
  export function nestedQuery(rc          : RunContextServer, 
                              fields      : Array<string | QueryField>,
                              query       : string,
                              condition  ?: string,
                              orderBy    ?: string[], 
                              groupBy    ?: string[], 
                              limit      ?: number) {

    let select = 'SELECT '
    const from = `FROM ( ${query} )`

    for (const fld of fields) {

      // Normalizing to QueryField
      let field : QueryField
      if (typeof fld !== 'string') {
        field = fld
      } else {
        field = {
                  name      : fld,
                  functions : []
                }
      }

      let selectField = field.name
      if (field.functions) {
        for (const func of field.functions) {
          selectField = BqQueryHelper.applyBqFunction(selectField, func)
        }  
      }
      select += selectField !== field.name ? `${selectField} as ${field.as || field.name}, ` 
                                           : `${selectField}, `
    }
    
    let retval = `${select} ${from} `
    if (condition) retval += `WHERE ${condition} `
    if (groupBy) retval += `GROUP BY ${groupBy} `
    if (orderBy) retval += `ORDER BY ${orderBy} `
    if (limit) retval += `LIMIT ${limit}`

    return retval
  }

  class BqQueryHelper {

    static applyBqFunction(field  : string, 
                           func   : BqFieldFunction | QUERY_FIELD_FUNCTION | string): string {

      const fun = BqQueryHelper.instanceOfBqFieldFunction(func) ? func.function : func
      switch(fun) {
  
        case QUERY_FIELD_FUNCTION.CONVERT_TO_DATE : 
          // return `EXTRACT(DATE FROM (${field}))`
          return `FORMAT_TIMESTAMP('%d/%m/%Y %H:%M:%S', (${field}))`

        case QUERY_FIELD_FUNCTION.CAST_STRING :
          return `CAST((${field}) AS STRING)`

        default :
          return `${func}(${field})`
      }
    }

    private static instanceOfBqFieldFunction(object: any): object is BqFieldFunction {
      return 'function' in object;
    }
  }

}
