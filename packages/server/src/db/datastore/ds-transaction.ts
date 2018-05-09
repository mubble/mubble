/*------------------------------------------------------------------------------
   About      : Transaction support for datastore
   
   Created on : Tue Jun 06 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {
        ERROR_CODES,
        DSError
       }                                         from './error-codes'
import {GcloudEnv}                               from '../../gcp/gcloud-env'
import {BaseDatastore}                           from './basedatastore'
import {RunContextServer}                        from '../../rc-server'
import * as lo                                   from 'lodash'

export class DSTransaction<T extends BaseDatastore<T> = any> {

  private _transaction : any
  private _namespace   : string
  private _kindname    : string
  private _datastore   : any
  private traceId      : string 
  private ack          : any
  private committed    : boolean = false
  private tranSteps    : Array<string> = []

  constructor(rc : RunContextServer, datastore : any, namespace : string, kindname : string) {
    this._transaction = datastore.transaction()
    this._namespace   = namespace
    this._kindname    = kindname
    this._datastore   = datastore
    this.traceId      = 'transaction_' + Date.now() + '_' + this._kindname
    this.ack          = rc.startTraceSpan(this.traceId)
  }

/*------------------------------------------------------------------------------
  - Get the datastore transaction Instance. Used in DSTQuery
------------------------------------------------------------------------------*/ 
  getTransaction(rc : RunContextServer) : any {
    return this._transaction
  }

/*------------------------------------------------------------------------------
  - Get an id, which can be assigned to a entity before insert
------------------------------------------------------------------------------*/ 
  async getIdFromTransaction(rc : RunContextServer, model : T , parentKey ?: any) : Promise<number> {
    const datastoreKey = model.getDatastoreKey(rc, null, false, parentKey),
          key          = await this._transaction.allocateIds(datastoreKey, 1) 

    model.setId(Number(key[0][0].id))
    return Number(key[0][0].id)
  }

/*------------------------------------------------------------------------------
  - Start a transaction
  - Needed only if we use a transaction outside models.
------------------------------------------------------------------------------*/
  async start(rc : RunContextServer) {
    const traceId = rc.getName(this) + ':' + 'transaction_start_' + this._kindname,
          ack     = rc.startTraceSpan(traceId)
    this.tranSteps.push (traceId)
    try {
      await this._transaction.run()
    } catch(err) {
      if(err.code) rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      else rc.isError() && rc.error(rc.getName(this), 'Unable to start transaction', err)
      throw(new DSError(ERROR_CODES.TRANSACTION_ERROR, err.message))
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
  }

/*------------------------------------------------------------------------------
  - Complete a transaction
  - Needed only if we use a transaction outside models.
------------------------------------------------------------------------------*/
  async commit(rc : RunContextServer) {
    const traceId = rc.getName(this) + ':' + 'transaction_commit_' + this._kindname,
          ack     = rc.startTraceSpan(traceId)
    this.tranSteps.push (traceId)
    try {
      await this._transaction.commit()
    } catch(err) {
      // Commit failed, Rolled back by DS.
      rc.isError() && rc.error(rc.getName(this), 'Transaction rolled back', err)
      throw(new DSError(ERROR_CODES.TRANSACTION_ERROR, err.message))
    } finally {
      this.committed = true 
      rc.endTraceSpan(traceId, ack)
      rc.endTraceSpan(this.traceId, this.ack)
    }
  }

/*------------------------------------------------------------------------------
  - Abandon a transaction
------------------------------------------------------------------------------*/
  async rollback(rc : RunContextServer) {
    const traceId = rc.getName(this) + ':' + 'transaction_rollback_' + this._kindname,
          ack     = rc.startTraceSpan(traceId)
    this.tranSteps.push (traceId)
    try {
      const resp = await this._transaction.rollback()
    } 
    catch (err) {
      rc.isWarn() && rc.warn (rc.getName (this), 'Transaction Steps before Rollback', this.committed, '/', JSON.stringify (this.tranSteps))
      rc.isWarn() && rc.warn (rc.getName (this), 'Ignoring Rollback Error:', !!this._transaction, err)
    } 
    finally {
      rc.endTraceSpan(traceId, ack)
      rc.endTraceSpan(this.traceId, this.ack)
    }
  }


/*------------------------------------------------------------------------------
  - Create a query
  - This only works for sub-entities = [Entities with a parent key]
------------------------------------------------------------------------------*/
  async createQuery(rc : RunContextServer, namespace : string, kindName : string) {
    return this._transaction.createQuery(namespace, kindName)
  }

/*------------------------------------------------------------------------------
  - Get with Transaction
------------------------------------------------------------------------------*/
  async get(rc : RunContextServer, model : T , ignoreRNF ?: boolean, parentKey ?: any) : Promise<boolean> {
    const traceId = rc.getName(this) + ':' + 'transaction_get_' + this._kindname,
          ack     = rc.startTraceSpan(traceId)
    this.tranSteps.push (traceId)
    try {
      
      const mId      : string | number = model.getId(rc),
            kindName : string          = (<any>model)._kindName || (model.constructor as any)._kindName

      rc.assert (rc.getName(this), !!mId, 'ID Cannot be Null/Undefined [Kind = ' + kindName + ']') 
      const key       = model.getDatastoreKey(rc, mId, false, parentKey),
            entityRec = await this._transaction.get(key)

      if(!entityRec[0]) {
        if(!ignoreRNF) throw(new DSError(ERROR_CODES.RECORD_NOT_FOUND, `[Kind: ${kindName}, Id: ${mId}]`))
        return false
      }

      model.deserialize(rc, entityRec[0])
      return true
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
  }

/*------------------------------------------------------------------------------
  - Get multiple entities
  - multiple models to be passed as an array
------------------------------------------------------------------------------*/
  async mGet(rc : RunContextServer, ignoreRNF : boolean, ...models : BaseDatastore[]) : Promise<boolean> {
    const traceId = rc.getName(this) + ':' + 'transaction_mget_' + this._kindname,
          ack     = rc.startTraceSpan(traceId)
    this.tranSteps.push (traceId)

    const keys : any = []

    await this.mGetInternal(rc, ignoreRNF, ...models)
    return true
  }

  private async mGetInternal(rc : RunContextServer, ignoreRNF : boolean, ...models : T[]) : Promise<boolean> {
    const keys : any = []

    models.forEach((model : T) => {
      rc.isAssert() && rc.assert(rc.getName(this), model instanceof BaseDatastore, 'model:', model, ', is not a valid BaseDataStore Model')
      rc.isAssert() && rc.assert(rc.getName(this), model.getId(rc), 'model id not set',model)
      
      keys.push(model.getDatastoreKey(rc, model.getId(rc)))
    })
    
    try {
      const res           = await this._transaction.get(keys),
            entityRecords = res[0]
            
      if(entityRecords.length !== models.length){
        if(!ignoreRNF) throw(new DSError(ERROR_CODES.RECORD_NOT_FOUND, `Keys: ${keys}`))
        return false
      }

      for(const entityRecord of entityRecords) {
        const id : string | number = BaseDatastore.getIdFromResult(rc , entityRecord) 
        // missing model result  are not present as undefined
        // we have to check the matching by id
        let model : any = models.find((mod : BaseDatastore)=> {
          return mod.getId(rc) === id
        })
        rc.isAssert() && rc.assert(rc.getName(this), model, 'model not found for ', entityRecord[BaseDatastore._datastore.KEY])
        model.deserialize(rc, entityRecord)
      }  
      return true
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
  }

/*------------------------------------------------------------------------------
  - Insert with Transaction
------------------------------------------------------------------------------*/
  async insert(rc : RunContextServer, model : any, parentKey ?: any, insertTime ?: number) : Promise<void> {
    const traceId = rc.getName(this) + ':' + 'transaction_insert_' + this._kindname,
          ack     = rc.startTraceSpan(traceId)
    this.tranSteps.push (traceId)

    const id           = model.getId(rc) || await this.getIdFromTransaction(rc, model, parentKey),
          datastoreKey = model.getDatastoreKey(rc, id, false, parentKey)
  
    try {
      model.setId(id)
      await BaseDatastore.mUniqueInsert(rc, this._transaction, model)
      this._transaction.save({key: datastoreKey, data: model.getInsertRec(rc, insertTime)})
    } finally {
      rc.endTraceSpan(traceId, ack)
    }      
  }

/*------------------------------------------------------------------------------
  - Bulk Insert with Transaction
------------------------------------------------------------------------------*/
  async mInsert(rc : RunContextServer, insertTime : number | undefined, ...recs : T[]) : Promise<boolean> {
    rc.isAssert() && rc.assert(rc.getName(this), !lo.isEmpty(recs), 'mUpdate models invalid')
    const models : T[] = lo.clone(recs) // Clone to ensure that the recs array is not spliced!

    await this.mInsertInternal(rc, insertTime, ...models)
    return true
  }

  async mInsertInternal(rc : RunContextServer, insertTime : number | undefined, ...models : T[]) : Promise<void> {
    const entities : Array<any> = []

    for(const model of models) {
      const mid = (<BaseDatastore>model).getId(rc) || await this.getIdFromTransaction(rc, model)
      model.setId(mid)
      entities.push({key : model.getDatastoreKey(rc, mid, false), data : model.getInsertRec(rc, insertTime)})
    }

    await BaseDatastore.mUniqueInsert(rc, this._transaction, ...models)
    this._transaction.save(entities)
  }


/*------------------------------------------------------------------------------
  - Update with Transaction. [Unique Check will only happen if updRec is passed]
------------------------------------------------------------------------------*/
  async update(rc : RunContextServer, model : BaseDatastore, updRec ?: any, parentKey ?: any) : Promise<void> {
    const traceId = rc.getName(this) + ':' + 'transaction_update_' + this._kindname,
          ack     = rc.startTraceSpan(traceId)
    this.tranSteps.push (traceId)

    const mId      : string | number = model.getId(rc),
          kindName : string          = (<any>model)._kindName || (model.constructor as any)._kindName
    
    try {
      if (updRec) { // Check Unique Constraints!
        await BaseDatastore.mUniqueUpdate (rc, this._transaction, model, updRec) 
        Object.assign(model, updRec)
      }
      rc.assert (rc.getName (this), !!mId, `ID Cannot be Null/Undefined [Kind: ${kindName}]`)
      this._transaction.save({key: model.getDatastoreKey(rc, mId, false, parentKey), data: model.getUpdateRec(rc)})
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
  }

/*------------------------------------------------------------------------------
  - Bulk Update with Transaction
------------------------------------------------------------------------------*/
  mUpdate(rc : RunContextServer, ...models : BaseDatastore[]) : void {
    const traceId = rc.getName(this) + ':' + 'transaction_mupdate_' + this._kindname,
          ack     = rc.startTraceSpan(traceId)
    this.tranSteps.push (traceId)

    const entities : any [] = []

    try {
      for(const model of models) {
        const mId      : string | number = model.getId(rc),
              kindName : string          = (<any>model)._kindName || (model.constructor as any)._kindName
        
        rc.assert (rc.getName (this), !!mId, `ID Cannot be Null/Undefined [Kind: ${kindName}]`)
        entities.push({key: model.getDatastoreKey(rc, mId), data: model.getUpdateRec(rc)})
      }
      
      this._transaction.save(entities)
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
  }

/*------------------------------------------------------------------------------
  - Delete with Transaction
------------------------------------------------------------------------------*/
  delete(rc : RunContextServer, model : T , parentKey ?: any) : void {
    const mId      : string | number = model.getId(rc),
          kindName : string          = (<any>model)._kindName || (model.constructor as any)._kindName

    rc.assert (rc.getName(this), !!mId, 'ID Cannot be Null/Undefined [Kind = ' + kindName + ']')
    this._transaction.delete(model.getDatastoreKey(rc, mId, false, parentKey))
  }

/*------------------------------------------------------------------------------
  - Bulk Delete with Transaction
------------------------------------------------------------------------------*/
  mDelete(rc : RunContextServer, ...models : T[]) : void {
    const keys : Array<any> = []

    for(const model of models) {
      const mId      : string | number = model.getId(rc),
            kindName : string          = (<any>model)._kindName || (model.constructor as any)._kindName

      rc.assert (rc.getName(this), !!mId, 'ID Cannot be Null/Undefined [Kind = ' + kindName + ']')
      keys.push(model.getDatastoreKey(rc, mId, false))
    }
    BaseDatastore.mUniqueDelete(rc, this._transaction, ...models)
    this._transaction.delete(keys)
  }
}