/*------------------------------------------------------------------------------
   About      : Transaction support for datastore
   
   Created on : Tue Jun 06 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {
        ERROR_CODES,
        DSError
       }                  from './error-codes'
import {GcloudEnv}        from '../../gcp/gcloud-env'
import {BaseDatastore}    from './basedatastore'
import {RunContextServer} from '../../rc-server'
import * as lo            from 'lodash'

export class DSTransaction {

  private _transaction : any
  private _namespace   : string
  private _datastore   : any

  constructor(rc : RunContextServer, datastore : any, namespace : string) {
    this._transaction = datastore.transaction()
    this._namespace   = namespace
    this._datastore   = datastore
  }

  public getTransaction(rc : RunContextServer) : any {
    return this._transaction
  }

  public async getIdFromTransaction(rc : RunContextServer, model : any, parentKey ?: any) {
    const datastoreKey = (parentKey) ? model.getDatastoreKey(rc, null, model._kindName, parentKey.path) 
                          : model.getDatastoreKey(rc),
          key          = await this._transaction.allocateIds(datastoreKey, 1) 

      return Number(key[0][0].id)
  }

  async start(rc : RunContextServer) { // Needed only if we use a transaction outside models.
    try {
      await this._transaction.run()
    } catch(err) {
      if(err.code) {
        rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      } else {
        rc.isError() && rc.error(rc.getName(this), 'Unable to start transaction', err)
      }
      throw(new DSError(ERROR_CODES.TRANSACTION_ERROR, err.message))
    }
  }

  async commit(rc : RunContextServer) { // Needed only if we use a transaction outside models.
    try {
      await this._transaction.commit()
    } catch(err) {
      await this._transaction.rollback()
      if(err.code) {
        rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      } else {
        rc.isError() && rc.error(rc.getName(this), 'Transaction rolled back', err)
      }
      throw(new DSError(ERROR_CODES.TRANSACTION_ERROR, err.message))
    }
  }

  // Note: This only works for sub-entities = [Entities with a parent key]
  async createQuery(rc : RunContextServer, namespace : string, kindName : string) {
    return this._transaction.createQuery(namespace, kindName)
  }

  async get(rc         : RunContextServer, 
            model      : any, 
            id         : number | string, 
            ignoreRNF ?: boolean) : Promise<void> {

    const kindName = (<any>model)._kindName || (model.constructor as any)._kindName
    rc.assert (rc.getName (this), !!id, 'ID Cannot be Null/Undefined [Kind = ' + kindName + ']') 

    const key           = model.getDatastoreKey(rc, id),
          entityRec     = await this._transaction.get(key),
          childEntities = model._childEntities

    if (!entityRec[0]) {
      if (!ignoreRNF) throw(new DSError(ERROR_CODES.RECORD_NOT_FOUND, `Id: ${id}`))
      return
    }
    model.deserialize(rc, entityRec[0])
    
    for (let childEntity in childEntities) {
      const child     = childEntities[childEntity],
            cModel    = child.model,
            dataModel = new cModel.constructor(),
            query     = cModel.createQuery(rc)
      
      query.hasAncestor(key)
      const res = await query.run(rc)

      if (!child.isArray) {
        const key = cModel.getKeyFromResult(rc, res[0][0])

        dataModel.getWithTransaction(rc, cModel, key, ignoreRNF)
        model.setChildEntity(rc, childEntity, dataModel.serialize(rc))
      } else {
        const resArr = []

        for (const val of res[0]) {
          const key = cModel.getKeyFromResult(rc, val)

          dataModel.getWithTransaction(rc, cModel, key, ignoreRNF)
          resArr.push(dataModel.serialize(rc))
        }
        model.setChildEntity(rc, childEntity, resArr)
      }
    }
  }

  async mget(rc        : RunContextServer, 
             ignoreRNF : boolean ,
             ...models : BaseDatastore[]) : Promise<boolean> {
    
    let result = true

    const keys : any = []
    rc.isAssert() && rc.assert(rc.getName(this), !lo.isEmpty(models) , 'mget models invalid ')

    models.forEach((model : BaseDatastore)=>{
      rc.isAssert() && rc.assert(rc.getName(this), model instanceof BaseDatastore , 'model ',model , 'is not a valid BaseDataStore Model')
      rc.isAssert() && rc.assert(rc.getName(this), model.getId(rc) , 'model id not set',model)

      const childEntities : any = (model as any)._childEntities

      rc.isAssert() && rc.assert(rc.getName(this), lo.isEmpty(childEntities) , 'child entities not supported in mget', model , childEntities)
      
      keys.push( model.getDatastoreKey(rc , model.getId(rc)))
    })
                  
    const res           = await this._transaction.get(keys) ,
          entityRecords = res[0]
          
    if(entityRecords.length !== models.length){
      if(!ignoreRNF) throw(new DSError(ERROR_CODES.RECORD_NOT_FOUND, `Keys: ${keys}`))
      result = false
    }

    for(let i = 0; i < entityRecords.length; i++) {
      const id : any = BaseDatastore.getIdFromResult(rc , entityRecords[i]) 
      // missing model result  are not present as undefined
      // we have to check the matching by id
      let model : any = models.find((mod : BaseDatastore)=> {
        return mod.getId(rc) === id
      })
      rc.isAssert() && rc.assert(rc.getName(this), model, 'model not found for ', entityRecords[i][BaseDatastore._datastore.KEY])
      model.deserialize(rc , entityRecords[i])
      
      
      /*
      const childEntities = model._childEntities
      
      for (let childEntity in childEntities) {
      
        const key     = model.getDatastoreKey(rc, id),
            child     = childEntities[childEntity],
            cModel    = child.model,
            dataModel = new cModel.constructor(),
            query     = cModel.createQuery(rc)
      
        query.hasAncestor(key)
        const res = await query.run(rc)

        if (!child.isArray) {
          const key = cModel.getKeyFromResult(rc, res[0][0])

          dataModel.getWithTransaction(rc, cModel, key, ignoreRNF)
          model.setChildEntity(rc, childEntity, dataModel.serialize(rc))
        } else {
          const resArr = []

          for (const val of res[0]) {
            const key = cModel.getKeyFromResult(rc, val)

            dataModel.getWithTransaction(rc, cModel, key, ignoreRNF)
            resArr.push(dataModel.serialize(rc))
          }
          model.setChildEntity(rc, childEntity, resArr)
      }
    }*/
      
    }  
    return result 
  }

  save(rc : RunContextServer, key : any, data : any) {
    this._transaction.save({key: key, data: data})
  }

  delete(rc : RunContextServer, key : any) {
    this._transaction.delete(key)
  }

  async insert(rc            : RunContextServer, 
               model         : any,
               id           ?: string | number | null, 
               parentKey    ?: any, 
               insertTime   ?: number, 
               ignoreDupRec ?: boolean) : Promise<boolean> {

    const newRec        = model.getInsertRec(rc, insertTime),
          childEntities = model._childEntities
          
    let datastoreKey = (parentKey) ? model.getDatastoreKey(rc, id || null, model._kindName, parentKey.path) 
                        : model.getDatastoreKey(rc, id)

    if (!id) { // If we already have a key, no need to allocate
      const key = await this._transaction.allocateIds(datastoreKey, 1) 

      model.setIdFromKey(rc, key[0][0])
      datastoreKey = key[0][0]
    } else {
      model.setId(id)
    }
    this._transaction.save({key: datastoreKey, data: newRec})

    // Check for Child Entities
    for (let childEntity in childEntities) {
      const isArray    = childEntities[childEntity].isArray,
            dsObjArray = (isArray) ? model[childEntity] : [ model[childEntity] ] // Put in an array if 'object'

      for(let dsObj of dsObjArray) {
        const cModel = childEntities[childEntity].model,
              obj    = new cModel.constructor()

        dsObj = obj.deserialize(rc, dsObj)
        await dsObj.insertWithTransaction(rc, cModel, datastoreKey, insertTime, ignoreDupRec)
      }
    }
    return true
  }

  async update(rc : RunContextServer, model : BaseDatastore) : Promise<void> {
    const mId = model.getId(rc)
    
    if(!mId) throw(new DSError(ERROR_CODES.RECORD_NOT_FOUND, `Id: ${mId}`))
    const key = model.getDatastoreKey(rc, mId)
    await this._transaction.save({key: key, data: model.getUpdateRec(rc)})
  }

  async mUpdate(rc : RunContextServer, ...models : BaseDatastore[]) : Promise<void> {
    
    const entities : any [] = []
    for(const model of models) {
      const mId = model.getId(rc)
    
      if(!mId) throw(new DSError(ERROR_CODES.RECORD_NOT_FOUND, `Id: ${mId}`))
      const key = model.getDatastoreKey(rc, mId)
      entities.push({key: key, data: model.getUpdateRec(rc)})
    }
    
    await this._transaction.save(entities)
  }


  async updateInternal( rc         : RunContextServer, 
                        model      : BaseDatastore, 
                        id         : number | string, 
                        updRec     : {[index : string] : any}, 
                        ignoreRNF ?: boolean) : Promise<void> {

    const key = model.getDatastoreKey(rc, id)
    if(updRec.modTs || updRec.createTs) throw(new DSError(ERROR_CODES.UNSUPPORTED_UPDATE_FIELDS, 'modTs and createTs Cannot be Updated'))
    const oldModTs = model.modTs
    await this.get(rc, model, id, ignoreRNF)
    if (oldModTs && oldModTs != model.modTs) {
      const kindName = (<any>model)._kindName || (model.constructor as any)._kindName
      const msg = 'Mod TS mismatch [' + kindName + '], ID = ' + id + ', Mod Times = ' + oldModTs + '/' + model.modTs
      rc.isError () && rc.error (rc.getName (this), msg)
      throw(new DSError(ERROR_CODES.MOD_TS_MISMATCH, msg))
    }
    Object.assign(model, updRec)
    this._transaction.save({key: key, data: model.getUpdateRec(rc)})
  }

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                      FUNCTIONS USED FROM BASEDATASTORE
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

  public async bdGet(rc         : RunContextServer, 
                     model      : BaseDatastore, 
                     id         : string | number, 
                     ignoreRNF ?: boolean) : Promise<boolean> {
    try {
      await this._transaction.run()
      await this.get (rc, model, id, ignoreRNF)
      await this._transaction.commit()
      return true
    } catch (err) {
      await this._transaction.rollback()
      if(err.code) {
        rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      } else {
        rc.isError() && rc.error(err)
      }
      throw(new DSError(ERROR_CODES.RECORD_NOT_FOUND, err.message))
    }
  }

  public async bdInsert(rc            : RunContextServer, 
                        model         : BaseDatastore, 
                        parentKey     : any, 
                        insertTime   ?: number, 
                        ignoreDupRec ?: boolean) : Promise<boolean> {
    try {
      await this._transaction.run()
      await this.insert(rc, model, null, parentKey, insertTime, ignoreDupRec)
      await this._transaction.commit()
      return true
    } catch(err) {
      await this._transaction.rollback()
      if(err.code) {
        rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      } else {
        rc.isError() && rc.error(err)
      }
      throw(new DSError(ERROR_CODES.RECORD_NOT_FOUND, err.message))
    }
  }

  public async bulkInsert(rc            : RunContextServer, 
                          model         : BaseDatastore, 
                          recs          : Array<BaseDatastore>, 
                          noChildren   ?: boolean, 
                          insertTime   ?: number, 
                          ignoreDupRec ?: boolean) : Promise<boolean> {
    try {
      await this._transaction.run()
      for(const rec of recs) {
        model.deserialize(rc, rec)
        const res = await model.setUnique(rc, this._transaction, ignoreDupRec)
        if(res) await this.insert(rc, model, null, null, insertTime, ignoreDupRec )
      }
      await this._transaction.commit()
      return true
    } catch(err) {
      for (let i in recs) { 
        model.deserialize(rc, recs[i])
        await model.deleteUnique(rc, this._transaction) 
      }
      await this._transaction.rollback()
      if(err.code) {
        rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      } else {
        rc.isError() && rc.error(err)
      }
      throw(new DSError(ERROR_CODES.RECORD_NOT_FOUND, err.message))
    }
  }

  public async bdUpdate(rc         : RunContextServer,
                        model      : BaseDatastore, 
                        id         : number | string, 
                        updRec     : BaseDatastore, 
                        ignoreRNF ?: boolean) : Promise<boolean> {
    try {
      await this._transaction.run()
      await this.updateInternal(rc, model, id, updRec, ignoreRNF)
      await this._transaction.commit()
      return true
    } catch(err) {
      await this._transaction.rollback()
      if(err.code) {
        rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      } else {
        rc.isError() && rc.error(err)
      }
      throw(new DSError(ERROR_CODES.RECORD_NOT_FOUND, err.message))
    }
  }

  public async bulkUpdate(rc          : RunContextServer, 
                          model       : BaseDatastore, 
                          updRecs     : Array<BaseDatastore>, 
                          insertTime ?: number, 
                          ignoreRNF  ?: boolean) : Promise<boolean> {
    try {
      await this._transaction.run()
      for(const rec of updRecs) {
        await this.updateInternal(rc, model, rec.getId(rc), rec, ignoreRNF)
      } 
      await this._transaction.commit()
      return true
    } catch(err) {
      await this._transaction.rollback()
      if(err.code) {
        rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      } else {
        rc.isError() && rc.error(err)
      }
      throw(new DSError(ERROR_CODES.RECORD_NOT_FOUND, err.message))
    }
  }

  public async softDelete(rc     : RunContextServer, 
                          model  : BaseDatastore, 
                          id     : number | string, 
                          params : any) : Promise<boolean> {
    try {
      await this._transaction.run()
      await this.updateInternal(rc, model, id, params, false)
      await model.deleteUnique(rc, this._transaction)
      await this._transaction.commit()
      return true
    } catch(err) {
      await this._transaction.rollback()
      if(err.code) {
        rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      } else {
        rc.isError() && rc.error(err)
      }
      throw(new DSError(ERROR_CODES.RECORD_NOT_FOUND, err.message))
    }
  }
}