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

  private _datastore : any
  private _namespace : string
  private _kindName  : string
  private _query     : any

  constructor(rc : RunContextServer, gcloudEnv : GcloudEnv, kindName : string) {
    this._namespace = gcloudEnv.namespace
    this._datastore = gcloudEnv.datastore
    this._kindName  = kindName.toLowerCase()
    this._query     = this._datastore.createQuery(this._namespace, this._kindName)
  }

  async run(rc : RunContextServer) : Promise<any> {
    const res = await this._datastore.runQuery(this._query)
    this.init(rc)
    return res
  }

  init(rc : RunContextServer) : void {
    this._query = this._datastore.createQuery(this._namespace, this._kindName)
  }

  filter(key : string, value : any, symbol ?: string) : void {
    if(!symbol) symbol = '='
    this._query = this._query.filter(key, symbol, value)
  }

  multiFilter(keyPairs: Array<{[index : string] : {key : string, value : any, symbol ?: string}}>) : void {
    for(let filter of keyPairs) {
      this._query = this._query.filter(filter.key, filter.symbol || '=', filter.value)
    }
  }

  order(key : string, value : any) : void {
    this._query = this._query.order(key, value)
  }

  multiOrder(keyPairs: Array<{[index : string] : {key : string, value : any}}>) : void {
    for(let filter of keyPairs) {
      this._query = this._query.order(filter.key, filter.value)
    }
  }

  hasAncestor(key : any) : void {
    this._query = this._query.hasAncestor(key)
  }

  limit(val : number) : void {
    this._query = this._query.limit(val)
  }
  
  groupBy(val : string) : void {
    this._query = this._query.groupBy(val)
  }

  select(val : Array<string>) : void {
    this._query = this._query.select(val)
  }
}