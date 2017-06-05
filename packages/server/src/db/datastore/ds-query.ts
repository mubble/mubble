/*------------------------------------------------------------------------------
   About      : query support for datastore
   
   Created on : Mon May 22 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {RunContextServer} from '../../rc-server'
import {ERROR_CODES}      from './error-codes'
import {GcloudEnv}        from '../../gcp/gcloud-env'

export class DSQuery {

  private _query     : any

  constructor(rc : RunContextServer, private datastore: any, private namespace : any, private kindName: any ) {
    this._query     = this.datastore.createQuery(namespace, kindName)
  }

  async run(rc : RunContextServer) : Promise<any> {
    const res = await this.datastore.runQuery(this._query)
    return res
  }

  // https://cloud.google.com/datastore/docs/concepts/queries#datastore-basic-query-nodejs [Check Cursors]
  async runCursor(rc : RunContextServer, pageCursor: string) : Promise<any> {
    this._query = this._query.start (pageCursor)
    const res = await this.datastore.runQuery(this._query)
  }

  filter(key : string, value : any, symbol ?: string) : DSQuery {
    if(!symbol) symbol = '='
    this._query = this._query.filter(key, symbol, value)
    return this
  }

  multiFilter(keyPairs: Array<{[index : string] : {key : string, value : any, symbol ?: string}}>) : DSQuery {
    for(let filter of keyPairs) {
      this._query = this._query.filter(filter.key, filter.symbol || '=', filter.value)
    }
    return this
  }

  order(key : string, value : any) : DSQuery {
    this._query = this._query.order(key, value)
    return this
  }

  multiOrder(keyPairs: Array<{[index : string] : {key : string, value : any}}>) : DSQuery {
    for(let filter of keyPairs) {
      this._query = this._query.order(filter.key, filter.value)
    }
    return this
  }

  hasAncestor(key : any) : DSQuery {
    this._query = this._query.hasAncestor(key)
    return this
  }

  limit(val : number) : DSQuery {
    this._query = this._query.limit(val)
    return this
  }
  
  groupBy(val : string) : DSQuery {
    this._query = this._query.groupBy(val)
    return this
  }

  select(val : Array<string>) : DSQuery {
    this._query = this._query.select(val)
    return this
  }
}