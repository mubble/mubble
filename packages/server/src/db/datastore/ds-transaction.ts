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
  private tranId       : string
  private ack          : any
  private tranSteps    : Array<string> = []

  constructor(rc : RunContextServer, datastore : any, namespace : string, kindname : string) {
    this._transaction = datastore.transaction()
    this._namespace   = namespace
    this._kindname    = kindname
    this._datastore   = datastore
    this.tranId       = 'transaction_' + this._kindname + '_' + Date.now()
    this.ack          = rc.startTraceSpan(this.tranId)
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
    const traceId = this.tranId + '_start',
          ack     = rc.startTraceSpan(traceId)
    this.tranSteps.push(traceId)
    rc.isDebug() && rc.debug(rc.getName(this), traceId + '=> Transaction Step Started')

    try {
      await this._transaction.run()
    } catch(err) {
      if(err.code) rc.isError() && rc.error(rc.getName(this), traceId + '[Error Code:' + err.code + '], Error Message:', err.message)
      else rc.isError() && rc.error(rc.getName(this), traceId + '=> Unable to start transaction', err)
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
    const traceId = this.tranId + '_commit',
          ack     = rc.startTraceSpan(traceId)
    this.tranSteps.push(traceId)
    rc.isDebug() && rc.debug(rc.getName(this), traceId + '=> Transaction Step Started')

    try {
      await this._transaction.commit()
    } catch(err) {
      // Commit failed, Rolled back by DS.
      rc.isError() && rc.error(rc.getName(this), traceId + '=> Commit Failed', err)
      throw(new DSError(ERROR_CODES.TRANSACTION_ERROR, err.message))
    } finally {
      rc.endTraceSpan(traceId, ack)
      rc.endTraceSpan(this.tranId, this.ack)
    }
  }

/*------------------------------------------------------------------------------
  - Abandon a transaction
------------------------------------------------------------------------------*/
  async rollback(rc : RunContextServer) {
    const traceId = this.tranId + '_rollback',
          ack     = rc.startTraceSpan(traceId)
    this.tranSteps.push(traceId)
    rc.isDebug() && rc.debug(rc.getName(this), traceId + '=> Transaction Step Started')
    
    try {
      const resp = await this._transaction.rollback()
    } 
    catch (err) {
      rc.isWarn() && rc.warn(rc.getName (this), 'Transaction Steps before Rollback', JSON.stringify (this.tranSteps))
      rc.isWarn() && rc.warn(rc.getName (this), traceId + '=> Ignoring Rollback Error:', !!this._transaction, err)
    } 
    finally {
      rc.endTraceSpan(traceId, ack)
      rc.endTraceSpan(this.tranId, this.ack)
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
  async get(rc : RunContextServer, model : T, ignoreRNF ?: boolean, parentKey ?: any) : Promise<boolean> {
    const traceId = this.tranId + '_get',
          ack     = rc.startTraceSpan(traceId)
    this.tranSteps.push(traceId)
    rc.isDebug() && rc.debug(rc.getName(this), traceId + '=> Transaction Step Started')

    try {
      const mId      : string | number = model.getId(rc),
            kindName : string          = (<any>model)._kindName || (model.constructor as any)._kindName

      rc.isAssert() && rc.assert(rc.getName(this), !!mId, traceId + '=> ID Cannot be Null/Undefined [Kind = ' + kindName + ']') 
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
  async mGet(rc : RunContextServer, ignoreRNF : boolean, ...models : T[]) : Promise<boolean> {
    const traceId = this.tranId + '_mget',
          ack     = rc.startTraceSpan(traceId)
    this.tranSteps.push(traceId)
    rc.isDebug() && rc.debug(rc.getName(this), traceId + '=> Transaction Step Started')

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
  async insert(rc : RunContextServer, model : T, parentKey ?: any, insertTime ?: number) : Promise<void> {
    const traceId = this.tranId + '_insert',
          ack     = rc.startTraceSpan(traceId)
    this.tranSteps.push(traceId)
    rc.isDebug() && rc.debug(rc.getName(this), traceId + '=> Transaction Step Started')

    const id           = model.getId(rc) || await this.getIdFromTransaction(rc, model, parentKey),
          datastoreKey = model.getDatastoreKey(rc, id, false, parentKey)
  
    try {
      model.setId(id)
      await this.mUniqueInsert(rc, model)
      this._transaction.save({key: datastoreKey, data: model.getInsertRec(rc, insertTime)})
    } finally {
      rc.endTraceSpan(traceId, ack)
    }      
  }

/*------------------------------------------------------------------------------
  - Bulk Insert with Transaction
------------------------------------------------------------------------------*/
  async mInsert(rc : RunContextServer, insertTime : number | undefined, ...recs : T[]) : Promise<boolean> {
    rc.isAssert() && rc.assert(rc.getName(this), !lo.isEmpty(recs), 'mInsert models invalid')
    const models : T[] = lo.clone(recs) // Clone to ensure that the recs array is not spliced!

    await this.mInsertInternal(rc, insertTime, ...models)
    return true
  }

  async mInsertInternal(rc : RunContextServer, insertTime : number | undefined, ...models : T[]) : Promise<void> {
    const traceId = this.tranId + '_minsert',
          ack     = rc.startTraceSpan(traceId)
    this.tranSteps.push(traceId)
    rc.isDebug() && rc.debug(rc.getName(this), traceId + '=> Transaction Step Started')

    const entities : Array<any> = []

    try {
      for(const model of models) {
        const mId      : string | number = (<BaseDatastore>model).getId(rc) || await this.getIdFromTransaction(rc, model),
              kindName : string          = (<any>model)._kindName || (model.constructor as any)._kindName
  
        model.setId(mId)
  
        rc.isAssert() && rc.assert(rc.getName (this), !!mId, `ID Cannot be Null/Undefined [Kind: ${kindName}]`)
        entities.push({key : model.getDatastoreKey(rc, mId, false), data : model.getInsertRec(rc, insertTime)})
      }
  
      await this.mUniqueInsert(rc, ...models)
      this._transaction.save(entities)
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
  }


/*------------------------------------------------------------------------------
  - Update with Transaction. [Unique Check will only happen if updRec is passed]
------------------------------------------------------------------------------*/
  async update(rc : RunContextServer, model : T, updRec ?: any, parentKey ?: any) : Promise<void> {
    const traceId = this.tranId + '_update',
          ack     = rc.startTraceSpan(traceId)
    this.tranSteps.push(traceId)
    rc.isDebug() && rc.debug(rc.getName(this), traceId + '=> Transaction Step Started')

    const mId      : string | number = model.getId(rc),
          kindName : string          = (<any>model)._kindName || (model.constructor as any)._kindName

    try {
      if (updRec) { // Check Unique Constraints!
        await this.mUniqueUpdate(rc, model, updRec) 
        Object.assign(model, updRec)
      }
      rc.isAssert() && rc.assert(rc.getName(this), !!mId, `ID Cannot be Null/Undefined [Kind: ${kindName}]`)
      this._transaction.save({key : model.getDatastoreKey(rc, mId, false, parentKey), data : model.getUpdateRec(rc)})
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
  }

/*------------------------------------------------------------------------------
  - Bulk Update with Transaction
------------------------------------------------------------------------------*/
  mUpdate(rc : RunContextServer, ...recs : T[]) : boolean {
    rc.isAssert() && rc.assert(rc.getName(this), !lo.isEmpty(recs), 'mUpdate models invalid')
    const models : T[] = lo.clone(recs) // Clone to ensure that the recs array is not spliced!

    this.mUpdateInternal(rc, ...models)
    return true
  }

  mUpdateInternal(rc : RunContextServer, ...models : T[]) : void {
    const traceId = this.tranId + '_mupdate',
          ack     = rc.startTraceSpan(traceId)
    this.tranSteps.push(traceId)
    rc.isDebug() && rc.debug(rc.getName(this), traceId + '=> Transaction Step Started')

    const entities : any [] = []

    try {
      for(const model of models) {
        const mId      : string | number = model.getId(rc),
              kindName : string          = (<any>model)._kindName || (model.constructor as any)._kindName
        
        rc.isAssert() && rc.assert(rc.getName(this), !!mId, `ID Cannot be Null/Undefined [Kind: ${kindName}]`)
        entities.push({key : model.getDatastoreKey(rc, mId), data : model.getUpdateRec(rc)})
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
    const traceId = this.tranId + '_delete',
          ack     = rc.startTraceSpan(traceId)
    this.tranSteps.push(traceId)
    rc.isDebug() && rc.debug(rc.getName(this), traceId + '=> Transaction Step Started')

    const mId      : string | number = model.getId(rc),
          kindName : string          = (<any>model)._kindName || (model.constructor as any)._kindName

    try {
      rc.isAssert() && rc.assert(rc.getName(this), !!mId, 'ID Cannot be Null/Undefined [Kind = ' + kindName + ']')
      this.mUniqueDelete(rc, model)
      this._transaction.delete(model.getDatastoreKey(rc, mId, false, parentKey))
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
  }

/*------------------------------------------------------------------------------
  - Bulk Delete with Transaction
------------------------------------------------------------------------------*/
  mDelete(rc : RunContextServer, ...models : T[]) : void {
    const traceId = this.tranId + '_mdelete',
          ack     = rc.startTraceSpan(traceId)
    this.tranSteps.push(traceId)
    rc.isDebug() && rc.debug(rc.getName(this), traceId + '=> Transaction Step Started')

    const keys : Array<any> = []

    try {
      for(const model of models) {
        const mId      : string | number = model.getId(rc),
              kindName : string          = (<any>model)._kindName || (model.constructor as any)._kindName
  
        rc.isAssert() && rc.assert(rc.getName(this), !!mId, 'ID Cannot be Null/Undefined [Kind = ' + kindName + ']')
        keys.push(model.getDatastoreKey(rc, mId, false))
      }
      this.mUniqueDelete(rc, ...models)
      this._transaction.delete(keys)
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
  }
/*------------------------------------------------------------------------------
  - Bulk Unique with Transaction
------------------------------------------------------------------------------*/
/*------------------------------------------------------------------------------
  - Unique params are identified and set as a primary key in a different
    collection to avoid duplication
  - Unique params are defined in the model
------------------------------------------------------------------------------*/
  async mUniqueInsert(rc : RunContextServer, ...models : T[]) : Promise<boolean> {
    rc.isAssert() && rc.assert(rc.getName(this), !lo.isEmpty(models) , 'mUnique: Number of Models to be Inserted: ZERO')

    const uniqueEntities = BaseDatastore.getUniqueEntities(rc, ...models)
    if(!uniqueEntities || !uniqueEntities.length) return true
    
    const keys          = uniqueEntities.map((entity) => entity.key),
          res           = await this._transaction.get(keys),
          entityRecords = res[0],
          resKeys       = entityRecords.map((entity : any) => BaseDatastore.getIdFromResult(rc, entity))
          
    if(entityRecords.length !== 0) { // Not Unique!
      rc.isWarn() && rc.warn(rc.getName(this), `One or more Unique Keys Exist [INS] : ${JSON.stringify(resKeys)}`)
      throw(new DSError(ERROR_CODES.UNIQUE_KEY_EXISTS, 'Unable to Insert, One or more Unique Keys Exist')) 
    }
    
    this._transaction.save(uniqueEntities)
    return true
  }

  async mUniqueUpdate(rc : RunContextServer, model : T, ...recs : any[]) : Promise<boolean> {
    rc.isAssert() && rc.assert(rc.getName(this), !lo.isEmpty(recs) , 'mUnique: Number of Records to be Updated: ZERO')

    const uniqueEntities = BaseDatastore.getUniqueEntitiesForUpdate(rc, model, ...recs)
    if(!uniqueEntities || !uniqueEntities.length) return true
    
    const keys          = uniqueEntities.map((entity) => entity.key),
          res           = await this._transaction.get(keys),
          entityRecords = res[0],
          resKeys       = entityRecords.map((entity : any) => BaseDatastore.getIdFromResult(rc, entity))
          
    if(entityRecords.length !== 0) { // Not Unique!
      rc.isWarn() && rc.warn(rc.getName(this), `One or more Unique Keys Exist [UPD] : ${JSON.stringify(resKeys)}`)
      throw(new DSError(ERROR_CODES.UNIQUE_KEY_EXISTS, 'Unable to Update, One or more Unique Keys Exist')) 
    }
    
    this._transaction.save(uniqueEntities)
    return true
  }

  mUniqueDelete(rc : RunContextServer, ...models : T[]) : boolean {
    rc.isAssert() && rc.assert(rc.getName(this), !lo.isEmpty(models) , 'mUnique: Number of Records to be Deleted: ZERO')

    const uniqueEntities = BaseDatastore.getUniqueEntities(rc, ...models)
    if(!uniqueEntities || !uniqueEntities.length) return true

    const delKeys = uniqueEntities.map((entity) => entity.key)
    this._transaction.delete(delKeys)
    return true
  }
}