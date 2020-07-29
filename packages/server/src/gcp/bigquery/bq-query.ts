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
export type BqOperator  = '=' | '!=' | '<' | '>' | '<=' | '>=' | 
                          'IN' | 'LIKE' | 'IS NULL' | 'NOT NULL' | 
                          'BETWEEN' | 'NOT IN'

export type EXTRACT_PART = 'DAYOFWEEK' | 'DAY' | 'DAYOFYEAR' | 'WEEK' | 
                           'ISOWEEK' | 'MONTH' | 'QUARTER' | 'YEAR' | 
                           'ISOYEAR'
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

export type QUERY_FIELD_FUNCTION = 'TEMPLATE' | 'CONVERT_TO_DATE' | 'ROUND' | 
                                   'SUM' | 'DISTINCT' | 'COUNT' | 'EXTRACT' | 
                                   'CAST_STRING' | 'CAST_NUMERIC' | 'COUNTIF' | 
                                   'FORMAT_TIMESTAMP' | 'STRING_AGG' |
                                   'ARRAY_AGG' | 'ARRAY_AGG_OFFSET_0'
export const QUERY_FIELD_FUNCTION : UnionKeyToValue<QUERY_FIELD_FUNCTION> = {
  COUNTIF             : 'COUNTIF', 
  TEMPLATE            : 'TEMPLATE',
  CONVERT_TO_DATE     : 'CONVERT_TO_DATE',
  ROUND               : 'ROUND',
  SUM                 : 'SUM',
  DISTINCT            : 'DISTINCT',
  COUNT               : 'COUNT',
  EXTRACT             : 'EXTRACT',
  CAST_STRING         : 'CAST_STRING',
  FORMAT_TIMESTAMP    : 'FORMAT_TIMESTAMP',
  CAST_NUMERIC        : 'CAST_NUMERIC',
  STRING_AGG          : 'STRING_AGG',
  ARRAY_AGG           : 'ARRAY_AGG',
  ARRAY_AGG_OFFSET_0  : 'ARRAY_AGG_OFFSET_0'
}

export interface QueryField {
  name        : string
  functions  ?: (QUERY_FIELD_FUNCTION | string)[]
  extract    ?: EXTRACT_PART
  as         ?: string
}

export interface QueryVariable {
  name  : string
  type  : 'STRING' | 'NUMERIC'
  value : any
}

export interface TemplateField {
  template : string,
  fields   : string[],
  as       : string
}

export interface NestedField {
  field      : BqFieldInfo
  functions  : (QUERY_FIELD_FUNCTION | string)[]
  extract   ?: EXTRACT_PART
  as        ?: string
}

export interface OrderBy {
  field : string
  type  : 'DESC' | 'ASC'
}

export namespace BqQueryBuilder {

    /**
   * @param rc RunContext, used for logging.
   * @param key key or field name.
   * @param value Value(s) of that field.
   * @param operator Conditional operator compatible with Bigquery. By default it is '='.
   * @param upper optional for case insensitive search. By default it is false.
   */
  export function newCondition(rc         : RunContextServer, 
                               key        : string, 
                               value     ?: any, 
                               operator   : BqOperator = '=',
                               stringVal  : boolean = true): string {

    rc.isDebug() && rc.debug(rc.getName(this), 'Creating new condition.', key, value, operator)

    let queryStr : string,
        conds    : Array<any> = []

    if(value instanceof Array) {

      for(const val of value) {
        conds.push(typeof val === 'string' ? `\'${val}\'` : `${val}`)
      }

      if (operator === 'BETWEEN') {
        queryStr = `(${key} ${operator} ${conds[0]} AND ${conds[1]})`
      } else if (operator === 'NOT IN') {
        queryStr = `NOT ${key} IN (${conds.join(', ')})`
      } else {
        queryStr = `(${key} ${operator} (${conds.join(', ')}))`
      }
      
    } else if(value === undefined || value === null) {
      queryStr = `(${key} ${operator})`  
    } else {
      queryStr = `(${key} ${operator} (${typeof value === 'string' && stringVal ? `\'${value}\'` : value}))`                   
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
    const queryString  = `(${conditions.join(` ${separator} \n `)})`
    return queryString
  }

  export function query(rc          : RunContextServer, 
                        projectId   : string,
                        table       : string, 
                        fields      : Array<string | QueryField | TemplateField>, 
                        condition  ?: string,
                        orderBy    ?: OrderBy[], 
                        groupBy    ?: string[], 
                        limit      ?: number): string {

    const registry     = BqRegistryManager.getRegistry(table),
          regFields    = registry.getFields(),
          nestedFields = {} as any
    
    let select = 'SELECT \n'
    const from = `FROM \`${projectId}.${registry.getDataset()}.${registry.getTableName()}\` \n`

    for (const fld of fields) {

      // Checking for TemplateField
      if (isOfTypeTemplateField(fld)) {

        for (let i=0; i<fld.fields.length; i++) {

          const tempField = fld.fields[i],
                regField  = regFields.find((regField) => regField.name === tempField)

          rc.isAssert() && rc.assert(rc.getName(this), regField, `Field ${tempField} does not exist on schema`)

          let value
          if (regField!!.parent) {
            if (!nestedFields[regField!!.parent]) nestedFields[regField!!.parent] = []
            value = `unnest_${regField!!.parent}.${tempField}`
          } else {
            value = tempField
          }

          //fld.template = fld.template.replace(`%${i}%`, `${value}`)
          fld.template = fld.template.split(`%${i}%`).join(`${value}`)
        }

        select += `${fld.template} as ${fld.as}, `

      } else {

        // Normalizing to QueryField
        let field : QueryField
        if (typeof fld === 'string') {
          field = {
            name      : fld,
            functions : []
          }
        } else if (isOfTypeQueryField(fld)) {
          field = fld
        }

        const regField = regFields.find((regField) => regField.name === field.name)

        rc.isAssert() && rc.assert(rc.getName(this), regField, `Field ${field!.name} does not exist on schema`)

        if (regField!!.parent) {
          if (!nestedFields[regField!!.parent]) nestedFields[regField!!.parent] = []
          const nestedField : NestedField = {
                                              field     : regField!!,
                                              functions : field!.functions || [],
                                              as        : field!.as
                                            }
          nestedFields[regField!!.parent].push(nestedField)

        } else {
          let selectField = field!.name
          if (field!.functions) {
            for (const func of field!.functions) {
              selectField = BqQueryHelper.applyBqFunction(selectField, func)
            }  
          }
          const sel = field!.as || field!.name        
          select += selectField !== sel ? `${selectField} as ${field!.as || field!.name}, `
                                        : `${selectField}, `
        }
      }

    }

    // For record
    let unnest = ''
    for (const key in nestedFields) {
      unnest += `,UNNEST (${key}) as unnest_${key} \n` 
      for (const nestedField of nestedFields[key]) {

        let selectField = `unnest_${key}.${nestedField.field.name}`
        for (const func of nestedField.functions) {
          selectField = BqQueryHelper.applyBqFunction(selectField, func)
        }
        const sel = nestedField.as || nestedField.field.name
        select += selectField !== sel ? `${selectField} as ${nestedField.as || nestedField.field.name}, `
                                      : `${selectField}, `
      }
    }

    let retval = `${select} ${from} ${unnest}`
    if (condition) retval += `WHERE ${condition} \n`
    if (groupBy) retval += `GROUP BY ${groupBy} \n`

    if (orderBy) {
      let str = ''
      for (let i=0; i<orderBy.length; i++) {
        if (i > 0) str += ', '
        const val = orderBy[i]
        str += `${val.field} ${val.type} `
      }
      retval += `ORDER BY ${str} \n`
    }

    if (limit) retval += `LIMIT ${limit} \n`

    return retval
  }

  function isOfTypeQueryField(object: Object): object is QueryField {
    return object.hasOwnProperty('name')
  }

  function isOfTypeTemplateField(object: Object): object is TemplateField {
    return object.hasOwnProperty('template')
  }

  /**
   * Field names are not checked in schema.  
   * Does not support UNNEST
   */
  export function nestedQuery(rc          : RunContextServer,
                              fields      : Array<string | QueryField | TemplateField>,
                              query       : string,
                              condition  ?: string,
                              orderBy    ?: OrderBy[],
                              groupBy    ?: string[],
                              limit      ?: number) {

    let select = 'SELECT \n'
    const from = `FROM ( ${query} ) \n`

    for (const fld of fields) {

      // Checking for TemplateField
      if (isOfTypeTemplateField(fld)) {

        for (let i=0; i<fld.fields.length; i++) {
          fld.template = fld.template.split(`%${i}%`).join(`${fld.fields[i]}`)
        }

        select += `${fld.template} as ${fld.as}, `

      } else {

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

        const sel = field.as || field.name
        select += selectField !== sel ? `${selectField} as ${sel}, ` 
                                      : `${selectField}, ` 
        }
    }
    
    let retval = `${select} ${from} `
    if (condition) retval += `WHERE ${condition} \n`
    if (groupBy) retval += `GROUP BY ${groupBy} \n`

    if (orderBy) {
      let str = ''
      for (let i=0; i<orderBy.length; i++) {
        if (i > 0) str += ', '
        const val = orderBy[i]
        str += `${val.field} ${val.type} `
      }
      retval += `ORDER BY ${str} \n`
    }

    if (limit) retval += `LIMIT ${limit} \n`

    return retval
  }

  export function addVariable(query: string, variable: QueryVariable): string {

    const str = `DECLARE ${variable.name} ${variable.type} DEFAULT ${
      variable.type === 'STRING' ? `\'${variable.value}\'`: variable.value};`
    return `${str} \n ${query}`
  }

  class BqQueryHelper {

    static applyBqFunction(field      : string, 
                           func       : QUERY_FIELD_FUNCTION | string,
                           ignoreNull : boolean = true): string {

      switch(func) {
  
        case QUERY_FIELD_FUNCTION.CONVERT_TO_DATE : 
          // return `EXTRACT(DATE FROM (${field}))`
          return `${QUERY_FIELD_FUNCTION.FORMAT_TIMESTAMP}('%d/%m/%Y %H:%M:%S', (${field}))`

        case QUERY_FIELD_FUNCTION.CAST_STRING :
          return `CAST((${field}) AS STRING)`

        case QUERY_FIELD_FUNCTION.CAST_NUMERIC :
          return `CAST((${field}) AS NUMERIC)`

        case QUERY_FIELD_FUNCTION.ROUND :
          return `ROUND (${field}, 2)`

        case QUERY_FIELD_FUNCTION.STRING_AGG :
          return `STRING_AGG(CAST(${field} AS STRING), ',')`

        case QUERY_FIELD_FUNCTION.ARRAY_AGG :
          return `ARRAY_AGG(${field} ${ignoreNull ? 'IGNORE NULLS' : ''})`

        case QUERY_FIELD_FUNCTION.ARRAY_AGG_OFFSET_0 :
          return `ARRAY_AGG(${field} ${ignoreNull ? 'IGNORE NULLS' : ''})[OFFSET(0)]`

        default :
          return `${func}(${field})`
      }
    }
  }

}
