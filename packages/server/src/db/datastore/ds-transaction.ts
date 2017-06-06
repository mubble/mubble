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

  public async runFunctions () {

  }

  public async get(rc : RunContextServer, model: BaseDatastore, key : any, ignoreRNF ?: boolean) : Promise<boolean> {
    try {
      await this._transaction.run()
      await this.getWithTransaction (rc, model, key, ignoreRNF)
      await this._transaction.commit()
      return true
    } catch (err) {
      await this._transaction.rollback()
      throw(err)
    }
  }

  public async insertInternal(rc : RunContextServer, model : BaseDatastore, parentKey : any, insertTime ?: number, ignoreDupRec ?: boolean) {
    try {
      await this._transaction.run()
      await this.insertWithTransaction(rc, model, parentKey, insertTime, ignoreDupRec)
      await this._transaction.commit()
      return true
    } catch(err) {
      await this._transaction.rollback()
      throw(err)
    }
  }

  public async bulkInsert(rc : RunContextServer, model : BaseDatastore, recs : Array<any>, noChildren ?: boolean, insertTime ?: number, ignoreDupRec ?: boolean) {
    try {
      await this._transaction.run()
      for(const rec of recs) {
        model.deserialize(rc, rec)
        const res = await model.setUnique (rc, ignoreDupRec)
        if(res) await this.insertWithTransaction(rc, model, null, insertTime, ignoreDupRec )
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

  public async update(rc : RunContextServer, model : BaseDatastore, id : number | string, updRec : any, ignoreRNF ?: boolean) {
    try {
      await this._transaction.run()
      await this.updateWithTransaction(rc, model, id, updRec, ignoreRNF)
      await this._transaction.commit()
      return true
    } catch(err) {
      await this._transaction.rollback()
      throw(err)
    }
  }

  public async bulkUpdate(rc : RunContextServer, model : BaseDatastore, updRecs : Array<any>, insertTime ?: number, ignoreRNF ?: boolean) {
    try {
      await this._transaction.run()
      for(const rec of updRecs) {
        await this.updateWithTransaction(rc, model, rec._id, rec, ignoreRNF)
      } 
      await this._transaction.commit()
      return true
    } catch(err) {
      await this._transaction.rollback()
      throw(err)
    }
  }

  public async softDelete(rc : RunContextServer, model : BaseDatastore, id : number | string, params : any) {
    try {
      await this._transaction.run()
      await this.updateWithTransaction (rc, model, id, params, false)
      await model.deleteUnique(rc)
      await this._transaction.commit()
      return true
    } catch(err) {
      await this._transaction.rollback()
      throw(err)
    }
  }

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                            INTERNAL FUNCTIONS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

  private async getWithTransaction(rc : RunContextServer, model : BaseDatastore, key : Array<any>, ignoreRNF ?: boolean) : Promise<void> {
    const entityRec     = await this._transaction.get(key),
          childEntities = model._childEntities

    if (!entityRec.length) {
      if (!ignoreRNF) throw(ERROR_CODES.RECORD_NOT_FOUND)
      return
    }
    model.setIdFromResult (rc, entityRec[0])
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

  private async insertWithTransaction(rc : RunContextServer, model : BaseDatastore, parentKey ?: any, insertTime ?: number, ignoreDupRec ?: boolean) {
    const newRec        = model.getInsertRec(rc, insertTime),
          childEntities = model._childEntities
          
    let datastoreKey = (parentKey) ? model.getDatastoreKey(rc, null, model._kindName, parentKey.path) : model.getDatastoreKey(rc)

    if (!model._id) { // If we already have a key, no need to allocate
      const key = await this._transaction.allocateIds(datastoreKey, 1) 

      model._id    = model.getIdFromResult(rc, key[0][0])
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

  private async updateWithTransaction(rc : RunContextServer, model : BaseDatastore, id : number | string, updRec : any, ignoreRNF ?: boolean) : Promise<void>{
    const key = model.getDatastoreKey(rc, id)

    await this.getWithTransaction(rc, model, key, ignoreRNF)
    Object.assign(this, updRec)
    this._transaction.save({key: key, data: model.getUpdateRec(rc)})
  }


}