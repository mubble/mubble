/*------------------------------------------------------------------------------
   About      : Transaction support for datastore
   
   Created on : Tue Jun 06 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {RunContextServer} from '../../rc-server'
import {ERROR_CODES}      from './error-codes'
import {GcloudEnv}        from '../../gcp/gcloud-env'
import {BaseDatastore}    from './basedatastore'

export class DSTransaction {

  private _transaction : any
  private _namespace   : any
  private _datastore   : any

  constructor(rc : RunContextServer, datastore : any, namespace : string) {
    this._transaction = datastore.transaction()
    this._namespace   = namespace
    this._datastore   = datastore
  }

  async start(rc : RunContextServer) { // Needed only if we use a transaction outside models.
    try {
      await this._transaction.run()
    } catch(err) {
      throw(err)
    }
  }

  async commit(rc : RunContextServer) { // Needed only if we use a transaction outside models.
    try {
      await this._transaction.commit()
    } catch(err) {
      await this._transaction.rollback()
      throw(err)
    }
  }

  async get(rc         : RunContextServer, 
            model      : BaseDatastore, 
            id         : number | string, 
            ignoreRNF ?: boolean) : Promise<void> {

    const key           = model.getDatastoreKey(rc, id),
          entityRec     = await this._transaction.get(key),
          childEntities = model._childEntities

    if (!entityRec.length) {
      if (!ignoreRNF) throw(ERROR_CODES.RECORD_NOT_FOUND)
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

  async insert(rc            : RunContextServer, 
               model         : BaseDatastore, 
               parentKey    ?: any, 
               insertTime   ?: number, 
               ignoreDupRec ?: boolean) : Promise<boolean> {

    const newRec        = model.getInsertRec(rc, insertTime),
          childEntities = model._childEntities
          
    let datastoreKey = (parentKey) ? model.getDatastoreKey(rc, null, model._kindName, parentKey.path) 
                        : model.getDatastoreKey(rc)

    if (!model.getId(rc)) { // If we already have a key, no need to allocate
      const key = await this._transaction.allocateIds(datastoreKey, 1) 

      model.setIdFromResult(rc, key[0][0])
      datastoreKey = key[0][0]
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

  async update(rc         : RunContextServer, 
               model      : BaseDatastore, 
               id         : number | string, 
               updRec     : any, 
               ignoreRNF ?: boolean) : Promise<void> {
                         
    const key = model.getDatastoreKey(rc, id)

    await this.get(rc, model, id, ignoreRNF)
    Object.assign(this, updRec)
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
      throw(err)
    }
  }

  public async bdInsert(rc            : RunContextServer, 
                        model         : BaseDatastore, 
                        parentKey     : any, 
                        insertTime   ?: number, 
                        ignoreDupRec ?: boolean) : Promise<boolean> {
    try {
      await this._transaction.run()
      await this.insert(rc, model, parentKey, insertTime, ignoreDupRec)
      await this._transaction.commit()
      return true
    } catch(err) {
      await this._transaction.rollback()
      throw(err)
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
        const res = await model.setUnique (rc, ignoreDupRec)
        if(res) await this.insert(rc, model, null, insertTime, ignoreDupRec )
      }
      await this._transaction.commit()
      return true
    } catch(err) {
      for (let i in recs) { 
        model.deserialize(rc, recs[i])
        await model.deleteUnique(rc) 
      }
      await this._transaction.rollback()
      throw(err)
    }
  }

  public async bdUpdate(rc         : RunContextServer,
                        model      : BaseDatastore, 
                        id         : number | string, 
                        updRec     : BaseDatastore, 
                        ignoreRNF ?: boolean) : Promise<boolean> {
    try {
      await this._transaction.run()
      await this.update(rc, model, id, updRec, ignoreRNF)
      await this._transaction.commit()
      return true
    } catch(err) {
      await this._transaction.rollback()
      throw(err)
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
        await this.update(rc, model, rec.getId(rc), rec, ignoreRNF)
      } 
      await this._transaction.commit()
      return true
    } catch(err) {
      await this._transaction.rollback()
      throw(err)
    }
  }

  public async softDelete(rc     : RunContextServer, 
                          model  : BaseDatastore, 
                          id     : number | string, 
                          params : any) : Promise<boolean> {
    try {
      await this._transaction.run()
      await this.update (rc, model, id, params, false)
      await model.deleteUnique(rc)
      await this._transaction.commit()
      return true
    } catch(err) {
      await this._transaction.rollback()
      throw(err)
    }
  }
}