/*------------------------------------------------------------------------------
   About      : Access point from which all the datastore functionalities are
                accessed. 
   
   Created on : Mon Apr 24 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const datastore : any = require('@google-cloud/datastore')

import {RunContextServer} from '../../rc-server'
import {ERROR_CODES}      from './error-codes'
import {GcloudEnv}        from '../../gcp/gcloud-env'
import {DSQuery}          from './ds-query'
import {DSTransaction}    from './ds-transaction'

export abstract class BaseDatastore {

  // Common fields in all the tables
  [index : string]           : any
  protected _id              : number | string
  protected createTs         : number
  protected deleted          : boolean = false
     
  // holds most recent values for create, modify or delete
  protected modTs            : number
  protected modUid           : number

  // Static Variables
  protected static _kindName : string
  static _datastore          : any
  static _namespace          : string
  static _autoFields         : Array<string> = ['createTs', 'deleted', 'modTs', 'modUid']
  static _indexedFields      : Array<string> = ['createTs', 'deleted', 'modTs']

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
          ABSTRACT FUNCTIONS. NEED TO BE IMPLEMENTED IN MODEL CLASS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */   
/*------------------------------------------------------------------------------
  - Get a list of Fields which need to be indexed in Datastore
  - Return Values is an array of
    - field Name in this Entity
  - Example: 
    return ['mobileNo', 'deactivated']
------------------------------------------------------------------------------*/                  
  abstract getIndexedFields(rc : RunContextServer) : Array<string>

/*------------------------------------------------------------------------------
  - Get a list of Fields which need to be checked for Uniqueness across the entire Entity
  - Return Values is an array of
    - field Name in this Entity
  - Example: 
    return ['mobileNo', 'emailId']
------------------------------------------------------------------------------*/                  
  abstract getUniqueConstraints(rc : RunContextServer) : Array<string>

/*------------------------------------------------------------------------------
  - Get Child Entities 
  - Return Values is an object with 
    - field Name of the childEntity within this Entity (Parent Entity)
    - value = Object containing an instance of the Child Entity & an indicator if the object is an array
  - Example: 
    return { 'userLink': { model: new UserLink(rc), isArray: true }}
------------------------------------------------------------------------------*/                  
  abstract getChildEntities(rc : RunContextServer) : {[index : string] : { model : BaseDatastore, isArray : boolean }} 

/*------------------------------------------------------------------------------
  - Set the child Entity value
  - Parameters
    - field Name of the childEntity within this Entity (Parent Entity)
    - value of the childEntity
------------------------------------------------------------------------------*/                  
  setChildEntity (rc : RunContextServer, name : string, val : Object) : void {
    this[name] = val
  }

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                      INITIALIZATION FUNCTION
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */   
  static init(rc : RunContextServer, gcloudEnv : GcloudEnv) {
    if (gcloudEnv.authKey) {
      gcloudEnv.datastore = datastore ({
        projectId   : gcloudEnv.projectId,
        credentials : gcloudEnv.authKey
      })
    } else {
      gcloudEnv.datastore = datastore ({
        projectId   : gcloudEnv.projectId
      })
    }
    this._namespace = gcloudEnv.namespace
    this._datastore = gcloudEnv.datastore
}

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                            BASIC DB OPERATIONS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */   
/*------------------------------------------------------------------------------
  - Get by primary key
------------------------------------------------------------------------------*/                  
  protected async get(rc : RunContextServer, id : number | string, ignoreRNF ?: boolean, noChildren ?: boolean) : Promise<boolean> {
    try {
      const key           = this.getDatastoreKey(rc, id),
            childEntities = this.getChildEntities(rc)

      if (!childEntities || Object.keys(childEntities).length === 0 || noChildren) {   
        const entityRec = await BaseDatastore._datastore.get(key)

        if (!entityRec.length) {
          if (ignoreRNF) return false
          throw (ERROR_CODES.RECORD_NOT_FOUND)
        }
        this.deserialize(rc, entityRec[0])

        return true       
      } else {
        const transaction : DSTransaction = new DSTransaction(rc, BaseDatastore._datastore, BaseDatastore._namespace)
        return transaction.bdGet (rc, this, id, ignoreRNF)
      }
    }
    catch (err) {
      if(err.code) {
        rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      } else {
        rc.isError() && rc.error(err)
      }
      throw(new Error(ERROR_CODES.GCP_ERROR))
    }
  }

/*------------------------------------------------------------------------------
  - Insert to datastore 

  Parameters:
  - insertTime     = Default is now()
  - ignoreDupRec   = Default is true [Ignore Duplicates... Ignore the Duplicate Error]
  - noChildren     = Default is true [No Children]
------------------------------------------------------------------------------*/ 
  protected async insert(rc : RunContextServer, insertTime ?: number, ignoreDupRec ?: boolean, noChildren ?: boolean) : Promise<boolean> {
    return await this.insertInternal(rc, null, insertTime, ignoreDupRec, noChildren)
  }

/*------------------------------------------------------------------------------
  - Insert a child, provided the parent key 
------------------------------------------------------------------------------*/ 
  protected async insertChild(rc : RunContextServer, parentKey : any, insertTime ?: number, ignoreDupRec ?: boolean, noChildren ?: boolean) : Promise<boolean> {
    return await this.insertInternal (rc, parentKey, insertTime, ignoreDupRec, noChildren)
  }

/*------------------------------------------------------------------------------
  - Insert a multiple objects in a go. provided, the objects are in an array
------------------------------------------------------------------------------*/ 
  protected static async bulkInsert(rc : RunContextServer, recs : Array<any>, noChildren ?: boolean, insertTime ?: number, ignoreDupRec ?: boolean) : Promise<boolean> {
    try {
      const model       : any           = Object.getPrototypeOf(this).constructor(),
            transaction : DSTransaction = new DSTransaction(rc, BaseDatastore._datastore, BaseDatastore._namespace)

      return transaction.bulkInsert(rc, model, recs, noChildren, insertTime, ignoreDupRec)
    }
    catch(err) {
      rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      throw(new Error(ERROR_CODES.GCP_ERROR))
    }
  }

/*------------------------------------------------------------------------------
  - Update
------------------------------------------------------------------------------*/ 
  protected async update(rc : RunContextServer, id : number | string, updRec : any, ignoreRNF ?: boolean) : Promise<boolean> {
    try {
      const transaction : DSTransaction = new DSTransaction(rc, BaseDatastore._datastore, BaseDatastore._namespace)
      return transaction.bdUpdate(rc, this, id, updRec, ignoreRNF)
    } 
    catch (err) {
      throw(new Error(ERROR_CODES.GCP_ERROR))
    }
  }

/*------------------------------------------------------------------------------
  - Update a multiple objects in a go
  - Input should be an an array of objects to be updated
  - The object should contain its ID in the "_id" parameter
------------------------------------------------------------------------------*/ 
  protected static async bulkUpdate(rc : RunContextServer, updRecs : Array<any>, insertTime ?: number, ignoreRNF ?: boolean) : Promise<boolean>{

    try {
      const model       : any           = Object.getPrototypeOf(this).constructor(),
            transaction : DSTransaction = new DSTransaction(rc, BaseDatastore._datastore, BaseDatastore._namespace)

      return transaction.bulkUpdate(rc, model, updRecs, insertTime, ignoreRNF)
    }
    catch (err) {
      rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      throw(new Error(ERROR_CODES.GCP_ERROR))
    }   
  }

/*------------------------------------------------------------------------------
  - Soft Delete
  - The 'deleted' param will be set as true
  - The unique param is deleted, if set
  - Optional params to be modified can be provided
------------------------------------------------------------------------------*/ 
  protected async softDelete(rc : RunContextServer, id : number | string, params : any) : Promise<boolean> {
    if(!params) params = {}   
    params.deleted = true
    try {
      const transaction : DSTransaction = new DSTransaction(rc, BaseDatastore._datastore, BaseDatastore._namespace)
      return transaction.softDelete(rc, this, id, params)
    } 
    catch (err) {
      rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      throw(new Error(ERROR_CODES.GCP_ERROR))
    }
  }
  
/*------------------------------------------------------------------------------
  - Get ID from result
  - ID is not returned while getting object or while querying
------------------------------------------------------------------------------*/
  static getIdFromResult(rc : RunContextServer, res : any) : number | string {
    const key = res[BaseDatastore._datastore.KEY].path   
    return key[key.length - 1]
  }

/*------------------------------------------------------------------------------
  - Get KEY from result
------------------------------------------------------------------------------*/
  static getKeyFromResult(rc : RunContextServer, res : any) {
    return res[BaseDatastore._datastore.KEY]
  }

/*------------------------------------------------------------------------------
  - Get the primary key 
------------------------------------------------------------------------------*/                  
  getId(rc : RunContextServer ) : number | string {
    return this._id
  }

/*------------------------------------------------------------------------------
  - Set the primary key 
------------------------------------------------------------------------------*/                  
  setIdFromResult(rc : RunContextServer , key : any) : void {
    const id = this.getIdFromResult(rc, key)
    this._id = id
  }

/*------------------------------------------------------------------------------
  - Create Query 
------------------------------------------------------------------------------*/
  static createQuery(rc : RunContextServer) {    
    if (!this._kindName) rc.warn(rc.getName(this), 'KindName: ', this._kindName)
    return new DSQuery(rc, BaseDatastore._datastore, BaseDatastore._namespace, this._kindName)
  }

/*------------------------------------------------------------------------------
  - Create Transaction 
------------------------------------------------------------------------------*/
  static createTransaction(rc : RunContextServer) {
    return new DSTransaction(rc, BaseDatastore._datastore, BaseDatastore._namespace)
  }

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                            UTILITY FUNCTIONS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

/*------------------------------------------------------------------------------
  - Deserialize: Assign the values of the object passed to the respective fields
------------------------------------------------------------------------------*/
  deserialize(rc : RunContextServer, value : any) : void {
    
    if(!this._id) this._id = BaseDatastore.getIdFromResult(rc, value)

    for (let prop in value) { 
      let val     = value[prop],
          dVal    = this[prop]
      
      if (prop.substr(0, 1) === '_' || val === undefined || val instanceof Function) continue
      
      if (dVal && typeof(dVal) === 'object' && dVal.deserialize instanceof Function) {
        this[prop] = dVal.deserialize(val)
      } else {
        this[prop] = val
      }
    }
  }
  
 /*------------------------------------------------------------------------------
  - Records are to be converted to a format accepted by datastore
  - 'insertRec' can be a model rec or a normal object
  - The whole model class along with fixed params defined in datastore is
    taken if 'insertRec' is not provided 
------------------------------------------------------------------------------*/
  getInsertRec(rc : RunContextServer, insertTime ?: number, insertRec ?: any) : Array<any> {
    let retArr : Array<any> = []
        
    insertRec  = insertRec  || this
    insertTime = insertTime || Date.now()
    
    if(Array.isArray(insertRec)) {
      for(let rec of insertRec) {
        rec.createTs = insertTime
        rec.modTs    = insertTime
        retArr       = retArr.concat(this.serialize(rc, rec))
      }
      return retArr
    } else {
      insertRec.createTs = insertTime
      insertRec.modTs    = insertTime
      return this.serialize(rc, insertRec) 
    }
  }

/*------------------------------------------------------------------------------
  - Records are to be converted to a format accepted by datastore
------------------------------------------------------------------------------*/
  getUpdateRec(rc : RunContextServer, updateRec ?: any, updateTime ?: number) : Array<any> {
    let retArr : Array<any> = []
        
    if (!updateRec) updateRec = this
    
    if(Array.isArray(updateRec)) {
      for(let rec of updateRec) {
        rec.modTs     = updateTime || Date.now()
        retArr        = retArr.concat(this.serialize(rc, rec))
      }
      return retArr
    } else {
      updateRec.modTs    = updateTime || Date.now()
      return this.serialize(rc, updateRec) 
    }
  }
  
/*------------------------------------------------------------------------------
  - Create the datastore key from the id, kindName and parent key path
  - Key should be in the format
    {
      namespace : 'namespace',
      path      : [The complete path]
    }
------------------------------------------------------------------------------*/
  getDatastoreKey(rc : RunContextServer, id ?: number | string | null , kindName ?: string, parentPath ?: Array<any>) {
    let datastoreKey

    if (!kindName) kindName = this._kindName || (this.constructor as any)._kindName
    if(!parentPath) {
      datastoreKey = BaseDatastore._datastore.key({
        namespace : BaseDatastore._namespace,
        path      : ([kindName, id]) 
      })
    } else {
      datastoreKey = BaseDatastore._datastore.key({
        namespace : BaseDatastore._namespace,
        path      : (parentPath.concat([kindName, id]))
      })
    }
    return datastoreKey
  }

/*------------------------------------------------------------------------------
  - Unique params are identified and set as a primary key in a different
    collection to avoid duplication
  - Unique params are defined in the model
------------------------------------------------------------------------------*/
  async setUnique(rc : RunContextServer, ignoreDupRec ?: boolean) : Promise<boolean> {
    const uniqueConstraints : any    = this.getUniqueConstraints(rc),
          childEntities     : any    = this.getChildEntities(rc),
          kindName          : string = this._kindName || (this.constructor as any)._kindName

    for( const constraint of uniqueConstraints) {
      let uniqueEntityKey = this.getDatastoreKey(rc, this[constraint], kindName + '_unique')
      try {
        await BaseDatastore._datastore.insert({key: uniqueEntityKey, data: ''})
      }
      catch (err) {
        if(!ignoreDupRec) {
          rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
          if (err.toString().split(':')[1] !== ' entity already exists') {
            throw(new Error(ERROR_CODES.GCP_ERROR))
          } else {
            throw(new Error(ERROR_CODES.UNIQUE_KEY_EXISTS))
          }
        } else {
          return false
        }
      }
    }
    for(let child in childEntities) {
      await childEntities[child].model.setUnique()
    }
    return true
  }

/*------------------------------------------------------------------------------
  - The unique keys are to be deleted when the corresponding entity is deleted
------------------------------------------------------------------------------*/
  async deleteUnique(rc : RunContextServer) : Promise<boolean> {
    const uniqueConstraints : any    = this.getUniqueConstraints(rc),
          childEntities     : any    = this.getChildEntities(rc),
          kindName          : string = this._kindName || (this.constructor as any)._kindName

    for( const constraint of uniqueConstraints) {
      let uniqueEntityKey = this.getDatastoreKey(rc, this[constraint], kindName + '_unique')
      try {
        await BaseDatastore._datastore.delete(uniqueEntityKey)
      } catch (err) {
        rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
        throw (new Error(ERROR_CODES.GCP_ERROR))
      }
    }
    for (let child in childEntities) {
      await childEntities[child].model.deleteUnique()
    }
    return true
  } 

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                            INTERNAL FUNCTIONS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

  private async insertInternal(rc : RunContextServer, parentKey : any, insertTime ?: number, ignoreDupRec ?: boolean, noChildren ?: boolean) : Promise<boolean> {
    const datastoreKey  = (parentKey) ? this.getDatastoreKey(rc, null, this._kindName, parentKey.path) : this.getDatastoreKey(rc),
          childEntities = this.getChildEntities(rc) 
    try {
      const res = await this.setUnique (rc, ignoreDupRec)
      if(res) {
        if ((!childEntities || Object.keys(childEntities).length === 0 || noChildren)) {
          await BaseDatastore._datastore.insert({key: datastoreKey, data: this.getInsertRec(rc, insertTime)})
          this._id = datastoreKey.path[datastoreKey.path.length - 1]
          return true
        } else {
          const transaction : DSTransaction = new DSTransaction(rc, BaseDatastore._datastore, BaseDatastore._namespace)
          return await transaction.bdInsert(rc, this, parentKey, insertTime, ignoreDupRec)
        }
      } else {
        return false
      }
    } catch (err) {
      rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      await this.deleteUnique (rc)
      if (err.toString().split(':')[1] !== ' entity already exists') {
        throw(new Error(ERROR_CODES.GCP_ERROR))
      } else {
        if (ignoreDupRec) return true
        throw(new Error(ERROR_CODES.RECORD_ALREADY_EXISTS))
      }
    }
  }

/*------------------------------------------------------------------------------
  - Serialize is towards Datastore. Need to convert it to Data format
------------------------------------------------------------------------------*/
  private serialize(rc : RunContextServer, value : any) : Array<any> { 
    const rec           = [],
          childEntities = this.getChildEntities(rc) 

    for (let prop in value) { 
      const indexedFields = BaseDatastore._indexedFields.concat(this.getIndexedFields(rc))
      let   val           = value[prop]

      if (prop.substr(0, 1) === '_' || val === undefined || val instanceof Function) continue
      if (val && typeof(val) === 'object' && val.serialize instanceof Function) {
        val = val.serialize(rc)
      }

      if(!(prop in childEntities)){
        rec.push ({ name: prop, value: val, excludeFromIndexes: (indexedFields.indexOf(prop) === -1) })
      }
    }
    return rec
  }
} 
