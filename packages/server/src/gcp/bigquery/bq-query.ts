/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Wed Feb 26 2020
   Author     : Siddharth Garg
   
   Copyright (c) 2020 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { RunContextServer }   from '../../rc-server'
import { BigQueryBaseModel }  from './bigquery-base-model'

export type BqSeparator = 'AND' | 'OR'
export type BqOperator  = '=' | '!=' | '<' | '>' | '<=' | '>=' | 'IN' | 'LIKE' | 'IS NULL' | 'NOT NULL'

export namespace BqQueryBuilder {

    /**
   * @param rc RunContext, used for logging.
   * @param key key or field name.
   * @param value Value(s) of that field.
   * @param operator Conditional operator compatible with Bigquery. By default it is '='.
   * @param upper optional for case insensitive search. By default it is false.
   */
  export function newCondition<T extends BigQueryBaseModel>(rc        : RunContextServer, 
                                                            key       : keyof T, 
                                                            value    ?: any, 
                                                            operator  : BqOperator = '=',
                                                            upper     : boolean    = false): string {

    rc.isDebug() && rc.debug(rc.getName(this), 'Creating new condition.', key, value, operator, upper)

    let queryStr : string,
        c        : number     = 1,
        conds    : Array<any> = []

    if(value instanceof Array) {
      for(const val of value) {
        conds.push(val)
      }
      
      queryStr = upper ? `(UPPER(${key}) ${operator} (${conds.join(', ')}))`
                       : `(${key} ${operator} (${conds.join(', ')}))`
    } else if(value === undefined || value === null) {
        queryStr = upper ? `(UPPER(${key}) ${operator})` 
                         : `(${key} ${operator})`  
    } else {
      queryStr = upper ? `(UPPER(${key}) ${operator} ${value})` 
                       : `(${key} ${operator} ${value})`                   
    }

    rc.isDebug() && rc.debug(rc.getName(this), 'newCondition', queryStr)
    
    return queryStr
  }

  /**
   * @param rc RunContext, used for logging.
   * @param conditions array of ObmopQueryCondition.
   * @param separator separator to join conditions.
   */
  export function joinConditions<T extends BigQueryBaseModel>(rc          : RunContextServer,
                                                              conditions  : Array<string>,
                                                              separator   : BqSeparator) : string {

    rc.isDebug() && rc.debug(rc.getName(this), 'joinConditons', conditions, separator)

    const queryString  = `(${conditions.join(` ${separator} `)})`
    return queryString
  }

  export function query(rc : RunContextServer, tableName: string, 
                        fields : Array<string>, query ?: string,
                        orderBy ?: string[], groupBy ?: string[], 
                        limit ?: number) {

  }

  export function nestedQuery() {

  }

}