/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Wed Feb 04 2020
   Author     : Yatharth Patel
   
   Copyright (c) 2020 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { RunContextServer }   from '../../rc-server'
import { ObmopBaseEntity }    from './obmop-base'
import * as lo                from 'lodash'

export type ObmopSeparator = 'AND' | 'OR'
export type ObmopOperator  = '=' | '<' | '>' | '<=' | '>=' | 'IN' | 'LIKE' | 'NOT NULL' | '!='

export type ObmopQueryCondition<T extends ObmopBaseEntity> = {
  queryStr : string
  binds    : Array<any>
}

export namespace QueryBuilder {

  /**
   * @param rc RunContext, used for logging.
   * @param key key or field name.
   * @param value Value of that field.
   * @param operator Conditional operator compatible with SQL databases. By default it is '='.
   * @param upper optional for case insensitive search. By default it is false.
   */

  export function newCondition<T extends ObmopBaseEntity>(
    rc       : RunContextServer, 
    key      : keyof T, 
    value    : any, 
    operator : ObmopOperator = '=',
    upper    : boolean       = false) : ObmopQueryCondition<T> {

    rc.isDebug() && rc.debug(rc.getName(this), 'Creating new condition.', key, value, operator, upper)  

    const binds = [] as Array<any>,
          conds = [] as Array<any>

      let queryString : string,
          c           : number = 1

    if(value instanceof Array) {
      for(const val of value) {
        conds.push(`:${c++}`)
        binds.push(val)
      }
      
      queryString = upper ? `(UPPER(${key}) ${operator} (${conds.join(', ')}))`
                          : `(${key} ${operator} (${conds.join(', ')}))`
    } else {
      binds.push(value)
      queryString = upper ? `(UPPER(${key}) ${operator} :${c++})` 
                          : `(${key} ${operator} :${c++})`                   
    }

    rc.isDebug() && rc.debug(rc.getName(this), 'newCondition', queryString, binds)

    return { 
              queryStr : queryString, 
              binds
            }                              
  }
  

  /**
   * @param rc RunContext, used for logging.
   * @param conditions array of ObmopQueryCondition.
   * @param separator separator to join conditions.
   */

  export function joinConditions<T extends ObmopBaseEntity>(
    rc         : RunContextServer,
    conditions : Array<ObmopQueryCondition<T>>,
    separator  : ObmopSeparator) : ObmopQueryCondition<T> {

    rc.isDebug() && rc.debug(rc.getName(this), 'joinConditons', conditions, separator)

    let count = 0

    const queryStrings = lo.concat([], conditions.map(cond => cond.queryStr)),
          binds        = lo.flattenDeep(lo.concat([], conditions.map(cond => cond.binds))),
          queryString  = `(${queryStrings.join(` ${separator} `)})`

    const queryMap = queryString.split(' ').map(char => {
      if(char.match(/:[0-9]+/) !== null) {
        count++
        return char.replace(/:[0-9]+/, `:${count}`)
      }
      return char
    })

    return {
             queryStr : queryMap.join(' '),
             binds
    }
  }
}
