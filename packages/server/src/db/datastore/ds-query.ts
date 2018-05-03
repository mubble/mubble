/*------------------------------------------------------------------------------
   About      : query support for datastore
   
   Created on : Mon May 22 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {RunContextServer} from '../../rc-server'
import {
        ERROR_CODES,
        DSError
       }                  from './error-codes'
import {GcloudEnv}        from '../../gcp/gcloud-env'
import {BaseDatastore , 
        BASEDATASTORE_PROTECTED_FIELDS}    from './basedatastore'

export class DSQuery<T extends BaseDatastore<T>> {

  private _query    : any
  private model     : any
  private namespace : any
  private kindName  : string
  private indexed   : string[]

  constructor(rc : RunContextServer, private datastore : any, kindName : string, model : any) {
    this.model     = model
    this.namespace = model.getNamespace(rc)
    this.kindName  = kindName
    this.indexed   = model.getIndexedFields(rc).concat(BaseDatastore._indexedFields)
    this._query    = this.datastore.createQuery(this.namespace, this.kindName)
  }

  async run(rc : RunContextServer) : Promise<[T[], any] | undefined> {
    const traceId : string = rc.getName(this)+':'+ this.kindName,
          ack = rc.startTraceSpan(traceId)
    let res : any
      try{
        res = await this.datastore.runQuery(this._query)
      }finally{
        rc.endTraceSpan(traceId,ack)
        return res
      }
    }
    

  async runCursor(rc : RunContextServer, pageCursor ?: string) : Promise<[T[], {moreResults ?: any , endCursor ?:any}] | null> {
    if(pageCursor) {
      this._query = this._query.start(pageCursor)
    }
    const res = await this.datastore.runQuery(this._query)
    return res
  }

  async runCursorTillNoMoreResults(rc : RunContextServer) : Promise<T[]>{

    let items : T[] = [] ,
        results  = await this.runCursor(rc)

    while(results){
      const msgs : T[]     = results[0],
      info                 = results[1]
      items = items.concat(msgs)
      
      results = null as any
      if(info.moreResults !== BaseDatastore._datastore.NO_MORE_RESULTS)
        results = await this.runCursor(rc, info.endCursor)
    }    

    return items
  }

  filter(key : keyof T | BASEDATASTORE_PROTECTED_FIELDS , value : T[keyof T] | number| boolean , symbol ?: string) : DSQuery<T> {
    if(this.indexed.indexOf(key) === -1) throw new Error(ERROR_CODES.FIELD_NOT_INDEXED + ' Filter key:' + key)
    if(value === undefined) throw new Error(ERROR_CODES.UNDEFINED_QUERY_FIELD + ' Filter key:' + key)
    if(!symbol) symbol = '='
    this._query = this._query.filter(key, symbol, value)
    return this
  }

  multiFilter(keyPairs : Array<{key : keyof T, value : T[keyof T] | number| boolean , symbol ?: string}>) : DSQuery<T> {
    for(const filter of keyPairs) {
      if(this.indexed.indexOf(filter.key) === -1) throw new Error(ERROR_CODES.FIELD_NOT_INDEXED + ' Filter key:' + filter.key)
      if(filter.value === undefined) throw new Error(ERROR_CODES.UNDEFINED_QUERY_FIELD+ ' Filter key:'+ filter.key)
      this._query = this._query.filter(filter.key, filter.symbol || '=', filter.value)
    }
    return this
  }

  order(key : keyof T | BASEDATASTORE_PROTECTED_FIELDS , descending ?: boolean) : DSQuery<T> {
    if(this.indexed.indexOf(key) === -1) throw new Error(ERROR_CODES.FIELD_NOT_INDEXED + ' Order key:' + key)
    if (!descending) this._query = this._query.order(key)
    else this._query = this._query.order(key, { descending: true })
    return this
  }

  multiOrder(keyPairs: Array<{key : keyof T , descending : boolean}>) : DSQuery<T> {
    for(let filter of keyPairs) {
      if(this.indexed.indexOf(filter.key) === -1) throw new Error(ERROR_CODES.FIELD_NOT_INDEXED + ' Order key:' + filter.key)
      if (!filter.descending) this._query = this._query.order(filter.key)
      else this._query = this._query.order(filter.key, { descending: true })
    }
    return this
  }

  hasAncestor(key : any) : DSQuery<T> {
    this._query = this._query.hasAncestor(key)
    return this
  }

  limit(val : number) : DSQuery<T> {
    this._query = this._query.limit(val)
    return this
  }
  
  groupBy(val : keyof T) : DSQuery<T> {
    if(this.indexed.indexOf(val) == -1) throw new Error(ERROR_CODES.FIELD_NOT_INDEXED + ' GroupBy key:' + val)
    this._query = this._query.groupBy(val)
    return this
  }

  select(val : Array<keyof T>) : DSQuery<T> {
    this._query = this._query.select(val)
    return this
  }

  async mQueryOr(rc : RunContextServer, key : keyof T , values : Array<T[keyof T]>) : Promise<T[]> {
    const traceId : string                = rc.getName(this) + ':' + 'mQueryOr',
          ack     : any                   = rc.startTraceSpan(traceId),
          queries : Array<DSQuery<T>>        = [],
          models  : Array<T>  = []

    try {
      for(const value of values) {
        const query = this.datastore.createQuery(this.namespace, this.kindName)
        query.filter(key, '=', value)
        queries.push(query)
      }

      const results = await Promise.all(queries.map(query => this.datastore.runQuery(query))) as Array<any>
      for(const result of results) {
        if(result && result[0] && result[0].length) {
          const entities = result[0],
                len      = entities.length
          
          for(let i = 0; i < len; i++) {
            const model : T = new (BaseDatastore as any)()
            model.deserialize(rc, entities.pop())

            models.push(model)
          }
        }
      }
      
      return models
    } catch(err) {
      if(err.code) rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      else rc.isError() && rc.error(err)
      throw(new DSError(ERROR_CODES.GCP_ERROR, err.message))
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
  }

  // Not working
  // static async mQueryOr(rc : RunContextServer, filterKey : string, values : Array<any>) : Promise<any[]> {
  //   const traceId : string     = rc.getName(this) + ':' + 'mQueryOr',
  //         ack     : any        = rc.startTraceSpan(traceId),
  //         ids     : Array<any> = []

  //   try {
  //     let query   = this._datastore.createQuery(this._namespace, this._kindName)
  //     query = query.select(['__key__', filterKey])

  //     const results = await this._datastore.runQuery(query)
  //     if(results && results[0] && results[0].length) {
  //       const entities = results[0] as Array<any>
  //       for(const entity of entities) {
  //         const index = values.indexOf(entity[filterKey])
  //         if(index !== -1) ids.push(entity.__key__)
  //       }
  //     }

  //     return ids
  //   } catch(err) {
  //     if(err.code) rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
  //     else rc.isError() && rc.error(err)
  //     throw(new DSError(ERROR_CODES.GCP_ERROR, err.message))
  //   } finally {
  //     rc.endTraceSpan(traceId, ack)
  //   }
  // }
}