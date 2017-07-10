/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri Jun 16 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {RunContextServer} from '../../rc-server'
import {ERROR_CODES}      from './error-codes'
import {GcloudEnv}        from '../../gcp/gcloud-env'

export class DSTQuery {

  private _tQuery : any

  constructor(rc : RunContextServer, private transaction: any , private namespace : string, private kindName: string) {
    this._tQuery = this.transaction.createQuery(namespace, kindName)
  }

  async run(rc : RunContextServer) : Promise<any> {
    const res = await this.transaction.runQuery(this._tQuery)
    return res
  }

  async runCursor(rc : RunContextServer, pageCursor ?: string) : Promise<any> {
    if(pageCursor) {
      this._tQuery = this._tQuery.start(pageCursor)
    }
    const res = await this.transaction.runQuery(this._tQuery)
    return res
  }

  filter(key : string, value : any, symbol ?: string) : DSTQuery {
    if(value === undefined) throw(ERROR_CODES.UNDEFINED_QUERY_FIELD, 'Filter key:', key)
    if(!symbol) symbol = '='
    this._tQuery = this._tQuery.filter(key, symbol, value)
    return this
  }

  multiFilter(keyPairs: Array<{[index : string] : {key : string, value : any, symbol ?: string}}>) : DSTQuery {
    for(let filter of keyPairs) {
      if(filter.value === undefined) throw(ERROR_CODES.UNDEFINED_QUERY_FIELD, 'Filter key:', filter.key)
      this._tQuery = this._tQuery.filter(filter.key, filter.symbol || '=', filter.value)
    }
    return this
  }

  order(key : string, descending ?: boolean) : DSTQuery {
    if (!descending) this._tQuery = this._tQuery.order(key)
    else this._tQuery = this._tQuery.order(key, { descending: true })
    return this
  }

  multiOrder(keyPairs: Array<{[index : string] : {key : string, descending : boolean}}>) : DSTQuery {
    for(let filter of keyPairs) {
      if (!filter.descending) this._tQuery = this._tQuery.order(filter.key)
    else this._tQuery = this._tQuery.order(filter.key, { descending: true })
    }
    return this
  }

  hasAncestor(key : any) : DSTQuery {
    this._tQuery = this._tQuery.hasAncestor(key)
    return this
  }

  limit(val : number) : DSTQuery {
    this._tQuery = this._tQuery.limit(val)
    return this
  }
  
  groupBy(val : string) : DSTQuery {
    this._tQuery = this._tQuery.groupBy(val)
    return this
  }

  select(val : Array<string>) : DSTQuery {
    this._tQuery = this._tQuery.select(val)
    return this
  }
}