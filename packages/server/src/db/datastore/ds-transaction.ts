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

export class DSTransaction {

  private _transaction : any
  private _namespace   : string
  private _datastore   : any
  private traceId      : string 
  private ack          : any  

  constructor(rc : RunContextServer, datastore : any, namespace : string) {
    this._transaction = datastore.transaction()
    this._namespace   = namespace
    this._datastore   = datastore
    if(rc.isTraceEnabled()){
      this.traceId = 'transaction_'+Date.now()
    }
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
  async getIdFromTransaction(rc : RunContextServer, model : any, parentKey ?: any) : Promise<number> {
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
    this.ack = rc.startTraceSpan(this.traceId)
    try {
      await this._transaction.run()
    } catch(err) {
      if(err.code) rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      else rc.isError() && rc.error(rc.getName(this), 'Unable to start transaction', err)
      throw(new DSError(ERROR_CODES.TRANSACTION_ERROR, err.message))
    }
  }

/*------------------------------------------------------------------------------
  - Complete a transaction
  - Needed only if we use a transaction outside models.
------------------------------------------------------------------------------*/
  async commit(rc : RunContextServer) {
    try {
      await this._transaction.commit()
    } catch(err) {
      await this._transaction.rollback()
      if(err.code) rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      else rc.isError() && rc.error(rc.getName(this), 'Transaction rolled back', err)
      throw(new DSError(ERROR_CODES.TRANSACTION_ERROR, err.message))
    }finally{
      rc.endTraceSpan(this.traceId , this.ack)
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
  async get(rc : RunContextServer, model : any, ignoreRNF ?: boolean, parentKey ?: any) : Promise<boolean> {
    const mId      : string | number = model.getId(rc),
          kindName : string          = (<any>model)._kindName || (model.constructor as any)._kindName

    rc.assert (rc.getName(this), !!mId, 'ID Cannot be Null/Undefined [Kind = ' + kindName + ']') 
    const key       = model.getDatastoreKey(rc, mId, false, parentKey),
          entityRec = await this._transaction.get(key)

    if (!entityRec[0]) {
      if (!ignoreRNF) throw(new DSError(ERROR_CODES.RECORD_NOT_FOUND, `[Kind: ${kindName}, Id: ${mId}]`))
      return false
    }
    model.deserialize(rc, entityRec[0])
    return true
  }

/*------------------------------------------------------------------------------
  - Get multiple entities
  - multiple models to be passed as an array
------------------------------------------------------------------------------*/
  async mGet(rc : RunContextServer, ignoreRNF : boolean, ...models : BaseDatastore[]) : Promise<boolean> {
    const keys : any = []

    rc.isAssert() && rc.assert(rc.getName(this), !lo.isEmpty(models) , 'mGet models invalid ')

    models.forEach((model : BaseDatastore) => {
      rc.isAssert() && rc.assert(rc.getName(this), model instanceof BaseDatastore, 'model:', model, ', is not a valid BaseDataStore Model')
      rc.isAssert() && rc.assert(rc.getName(this), model.getId(rc), 'model id not set',model)
      
      keys.push(model.getDatastoreKey(rc, model.getId(rc)))
    })
                  
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
  }

/*------------------------------------------------------------------------------
  - Insert with Transaction
------------------------------------------------------------------------------*/
  async insert(rc : RunContextServer, model : any, parentKey ?: any, insertTime ?: number) : Promise<void> {
    const id           = model.getId(rc) || await this.getIdFromTransaction(rc, model, parentKey),
          datastoreKey = model.getDatastoreKey(rc, id, false, parentKey)
    
    model.setId(id)
    this.setUnique(rc, model)
    this._transaction.save({key: datastoreKey, data: model.getInsertRec(rc, insertTime)})
  }

/*------------------------------------------------------------------------------
  - Update with Transaction
------------------------------------------------------------------------------*/
  update(rc : RunContextServer, model : BaseDatastore, parentKey ?: any) : void {
    const mId      : string | number = model.getId(rc),
          kindName : string          = (<any>model)._kindName || (model.constructor as any)._kindName
    
    rc.assert (rc.getName (this), !!mId, `ID Cannot be Null/Undefined [Kind: ${kindName}]`)
    this._transaction.save({key: model.getDatastoreKey(rc, mId, false, parentKey), data: model.getUpdateRec(rc)})
  }

/*------------------------------------------------------------------------------
  - Bulk Update with Transaction
------------------------------------------------------------------------------*/
  mUpdate(rc : RunContextServer, ...models : BaseDatastore[]) : void {
    const entities : any [] = []

    for(const model of models) {
      const mId      : string | number = model.getId(rc),
            kindName : string          = (<any>model)._kindName || (model.constructor as any)._kindName
      
      rc.assert (rc.getName (this), !!mId, `ID Cannot be Null/Undefined [Kind: ${kindName}]`)
      entities.push({key: model.getDatastoreKey(rc, mId), data: model.getUpdateRec(rc)})
    }
    
    this._transaction.save(entities)
  }

/*------------------------------------------------------------------------------
  - Delete with Transaction
------------------------------------------------------------------------------*/
  delete(rc : RunContextServer, model : BaseDatastore, parentKey ?: any) : void {
    const mId      : string | number = model.getId(rc),
          kindName : string          = (<any>model)._kindName || (model.constructor as any)._kindName

    rc.assert (rc.getName(this), !!mId, 'ID Cannot be Null/Undefined [Kind = ' + kindName + ']') 
    this._transaction.delete(model.getDatastoreKey(rc, mId, false, parentKey))
  }

/*------------------------------------------------------------------------------
  - Unique params are identified and set as a primary key in a different
    collection to avoid duplication
  - Unique params are defined in the model
------------------------------------------------------------------------------*/
  setUnique(rc : RunContextServer, model : any) : void {
    const uniqueConstraints : any    = model.getUniqueConstraints(rc),
          kindName          : string = model._kindName

    for(const constraint of uniqueConstraints) {
      let uniqueEntityKey = model.getDatastoreKey(rc, model[constraint], true)

      this._transaction.save({key: uniqueEntityKey, method: 'insert', data: ''})
    }
  }

/*------------------------------------------------------------------------------
- The unique keys are to be deleted when the corresponding entity is deleted
------------------------------------------------------------------------------*/
  deleteUnique(rc : RunContextServer, model : any) : void {
    const uniqueConstraints : any    = model.getUniqueConstraints(rc),
          kindName          : string = model._kindName

    for(const constraint of uniqueConstraints) {
      let uniqueEntityKey = model.getDatastoreKey(rc, model[constraint], true)

      this._transaction.delete(uniqueEntityKey)
    }
  } 
}