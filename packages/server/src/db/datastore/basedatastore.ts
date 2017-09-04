/*------------------------------------------------------------------------------
   About      : Access point from which all the datastore functionalities are
                accessed. 
   
   Created on : Mon Apr 24 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const datastore : any = require('@google-cloud/datastore')

import {
        ERROR_CODES,
        DSError
       }                  from './error-codes'
import {GcloudEnv}        from '../../gcp/gcloud-env'
import {DSQuery}          from './ds-query'
import {DSTQuery}         from './dst-query'
import {DSTransaction}    from './ds-transaction'
import {RunContextServer} from '../../rc-server'
import * as lo            from 'lodash'

const GLOBAL_NAMESPACE : string = '--GLOBAL--'

export abstract class BaseDatastore {

  // Common fields in all the tables
  protected _id              : number | string
  protected createTs         : number
  protected deleted          : boolean = false
     
  // holds most recent values for create, modify or delete
  public    modTs            : number
  protected modUid           : number

  // Static Variables
  protected static _kindName : string
  static _datastore          : any
  private static _namespace  : string
  static _autoFields         : Array<string> = ['createTs', 'deleted', 'modTs', 'modUid']
  static _indexedFields      : Array<string> = ['createTs', 'deleted', 'modTs']

  constructor(id ?: string | number) {
    if(id) this._id = id
  }

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
  // TODO: (AD) Redo the documentation
  - Get Child Entities 
  - Return Values is an object with 
    - field Name of the childEntity within this Entity (Parent Entity)
    - value = Object containing an instance of the Child Entity & an indicator if the object is an array
  - Example: 
    return { 'userLink': { model: new UserLink(rc), isArray: true }}
------------------------------------------------------------------------------*/                  
  // abstract getChildLinks(rc : RunContextServer) : [string] 
  // abstract isChildOf (rc : RunContextServer) : BaseDatastore 
  

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
                            NAMESPACE RELATED
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */   
/*------------------------------------------------------------------------------
  - Tells whether this model is using global namespace or machine env specific namespace (local)
  - Defaults to false , which means machine env namespace will be used.
  - Models wish to be global namespace can override this and return true
------------------------------------------------------------------------------*/ 
public isGlobalNamespace() : boolean {
  return false
} 

/*------------------------------------------------------------------------------
  - Get the namespace string depending upon whether namespace is global or local
------------------------------------------------------------------------------*/ 

private getNamespace() : string {
  return this.isGlobalNamespace() ? GLOBAL_NAMESPACE : BaseDatastore._namespace
}

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                            BASIC DB OPERATIONS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */   


/*------------------------------------------------------------------------------
  - Get by primary key
------------------------------------------------------------------------------*/                  
  protected async get(rc : RunContextServer, id : number | string, ignoreRNF ?: boolean) : Promise<boolean> {
    try {
      const key      = this.getDatastoreKey(rc, id),
            kindName = (<any>this)._kindName || (this.constructor as any)._kindName
      rc.assert (rc.getName (this), !!id, 'ID Cannot be Null/Undefined [Kind = ' + kindName + ']') 
      const entityRec = await BaseDatastore._datastore.get(key)

        if (!entityRec[0]) {
          if (ignoreRNF) return false
          throw(new DSError(ERROR_CODES.RECORD_NOT_FOUND, `Id: ${id}`))
        }
        this.deserialize(rc, entityRec[0])
        return true

    } catch (err) {
      if(err.code) rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      else rc.isError() && rc.error(err)
      throw(new DSError(ERROR_CODES.GCP_ERROR, err.message))
    }
  }

  static async mget(rc : RunContextServer , ignoreRNF : boolean , ...models : BaseDatastore[]) : Promise<boolean> {
    let result = true
      
    try {
      const keys : any = []
      rc.isAssert() && rc.assert(rc.getName(this), !lo.isEmpty(models) , 'mget models invalid')

      models.forEach((model : BaseDatastore) => {
        rc.isAssert() && rc.assert(rc.getName(this), model instanceof BaseDatastore , 'Model:', model , ', is not a valid BaseDataStore Model')
        rc.isAssert() && rc.assert(rc.getName(this), model.getId(rc) , 'model id not set', model)

        keys.push(model.getDatastoreKey(rc, model.getId(rc)))
      })
      
      const res                   = await BaseDatastore._datastore.get(keys),
            entityRecords : any[] = res[0]
      
      if(entityRecords.length !== models.length){
        if(!ignoreRNF) throw(new DSError(ERROR_CODES.RECORD_NOT_FOUND, `Keys: ${keys}`))
        result = false
      }

      for(let i = 0; i < entityRecords.length; i++) {
        const id : string | number = BaseDatastore.getIdFromResult(rc , entityRecords[i]) 
        // missing model result  are not present as undefined
        // we have to check the matching by id
        let model : any = models.find((mod : BaseDatastore)=> {
          return mod.getId(rc) === id
        })
        rc.isAssert() && rc.assert(rc.getName(this), model , 'model not found for ' , entityRecords[i][BaseDatastore._datastore.KEY])
        model.deserialize(rc , entityRecords[i])
      }
    } catch(err) {
      if(err.code) rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      else rc.isError() && rc.error(err)
      throw(new DSError(ERROR_CODES.GCP_ERROR, err.message))
    }

    return result
  }

/*------------------------------------------------------------------------------
  - Insert to datastore 

  Parameters:
  - insertTime     = Default is now()
  - ignoreDupRec   = Default is true [Ignore Duplicates... Ignore the Duplicate Error]
  - noChildren     = Default is true [No Children]
------------------------------------------------------------------------------*/ 
  protected async insert(rc : RunContextServer, insertTime ?: number, ignoreDupRec ?: boolean) : Promise<boolean> {
    try {
      const res          = await this.setUnique(rc, ignoreDupRec),
            datastoreKey = this.getDatastoreKey(rc)

      if(!res) return false
      await BaseDatastore._datastore.save({key: datastoreKey, data: this.getInsertRec(rc, insertTime)})
      this.setIdFromKey(rc, datastoreKey)
      return true
    } catch (err) {
      rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      if (err.toString().split(':')[1] !== ' entity already exists') {
        throw(new DSError(ERROR_CODES.GCP_ERROR, err.message))
      } else {
        if (ignoreDupRec) return true
        throw(new DSError(ERROR_CODES.RECORD_ALREADY_EXISTS, err.message))
      }
    }
  }

/*------------------------------------------------------------------------------
  - Insert a child.
  - Populated child model should be provided
  - Parent Id should be populated in the parent
------------------------------------------------------------------------------*/ 
  protected async insertChild(rc : RunContextServer, childModel : any, ignoreDupRec ?: boolean, insertTime ?: number) : Promise<boolean> {
    // TODO: (AD) Check using isChildOf, getChildLinks..
    try {
      const res          = await childModel.setUnique(rc, undefined, ignoreDupRec),
            parentKey    = this.getDatastoreKey(rc, this.getId(rc)),
            datastoreKey = childModel.getDatastoreKey(rc, null, false, parentKey)

      if(!res) return false
      await BaseDatastore._datastore.save({key: datastoreKey, data: childModel.getInsertRec(rc, insertTime)})
      return true
    } catch (err) {
      rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      if (err.toString().split(':')[1] !== ' entity already exists') {
        throw(new DSError(ERROR_CODES.GCP_ERROR, err.message))
      } else {
        if (ignoreDupRec) return true
        throw(new DSError(ERROR_CODES.RECORD_ALREADY_EXISTS, err.message))
      }
    }
  }

/*------------------------------------------------------------------------------
  - Update
------------------------------------------------------------------------------*/ 
  protected async update(rc : RunContextServer, id : number | string, updRec : any, ignoreRNF ?: boolean) : Promise<boolean> {
    try {
      const datastoreKey = this.getDatastoreKey(rc, id)

      this._id = id
      const res = await BaseDatastore._datastore.get(datastoreKey)
      if(!res || !res[0]) throw(new DSError(ERROR_CODES.RECORD_NOT_FOUND, `Key: ${datastoreKey}`))
      this.deserialize(rc, res[0])
      Object.assign(this, updRec)
      await BaseDatastore._datastore.save({key: datastoreKey, data: this.getUpdateRec(rc)})
      return true
    } 
    catch (err) {
      throw(new DSError(ERROR_CODES.GCP_ERROR, err.message))
    }
  }

/*------------------------------------------------------------------------------
  - Update a child.
  - Populated child model should be provided
  - Parent Id should be populated in the parent
------------------------------------------------------------------------------*/ 
protected async updateChild(rc : RunContextServer, childModel : any, updRec : any, ignoreRNF ?: boolean) : Promise<boolean> {
  // TODO: Validate Child Parent Relationships..
  try {
    const parentKey    = this.getDatastoreKey(rc, this.getId(rc)),
          datastoreKey = childModel.getDatastoreKey(rc, null, false, parentKey)

    const res = await BaseDatastore._datastore.get(datastoreKey)
    if(!res || !res[0]) throw(new DSError(ERROR_CODES.RECORD_NOT_FOUND, `Key: ${datastoreKey}`))
    childModel.deserialize(rc, res[0])
    Object.assign(childModel, updRec)
    await BaseDatastore._datastore.save({key: datastoreKey, data: childModel.getUpdateRec(rc)})
    return true
  } 
  catch (err) {
    throw(new DSError(ERROR_CODES.GCP_ERROR, err.message))
  }
}

/*------------------------------------------------------------------------------
  - Soft Delete
  - The 'deleted' param will be set as true
  - The unique param is deleted, if set
  - Optional params to be modified can be provided
------------------------------------------------------------------------------*/ 
  protected async softDelete(rc : RunContextServer, id : number | string, params ?: {[index : string] : any}, ignoreRNF ?: boolean) : Promise<boolean> {
    try {
      const datastoreKey = this.getDatastoreKey(rc, id)
      
      this._id = id
      const res = await BaseDatastore._datastore.get(datastoreKey)
      if(!res || !res[0]) throw(new DSError(ERROR_CODES.RECORD_NOT_FOUND, `Key: ${datastoreKey}`))
      this.deserialize(rc, res[0])
      this.deleted = true
      if(params) Object.assign(this, params)
      await BaseDatastore._datastore.save({key: datastoreKey, data: this.getUpdateRec(rc)})
      return true
    } 
    catch (err) {
      rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      throw(new DSError(ERROR_CODES.GCP_ERROR, err.message))
    }
  }

/*------------------------------------------------------------------------------
  - Soft Delete Child
  - The 'deleted' param will be set as true
  - The unique param is deleted, if set
  - Optional params to be modified can be provided
------------------------------------------------------------------------------*/ 
protected async softDeleteChild(rc : RunContextServer, childModel : any, params ?: {[index : string] : any}, ignoreRNF ?: boolean) : Promise<boolean> {
  try {
    const parentKey    = this.getDatastoreKey(rc, this.getId(rc)),
          datastoreKey = childModel.getDatastoreKey(rc, null, false, parentKey)
    
    const res = await BaseDatastore._datastore.get(datastoreKey)
    if(!res || !res[0]) throw(new DSError(ERROR_CODES.RECORD_NOT_FOUND, `Key: ${datastoreKey}`))
    childModel.deserialize(rc, res[0])
    childModel.deleted = true
    if(params) Object.assign(childModel, params)
    await BaseDatastore._datastore.save({key: datastoreKey, data: childModel.getUpdateRec(rc)})
    return true
  } 
  catch (err) {
    rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
    throw(new DSError(ERROR_CODES.GCP_ERROR, err.message))
  }
}
  
/*------------------------------------------------------------------------------
  - Get ID from result
  - ID is not returned while getting object or while querying
------------------------------------------------------------------------------*/
  static getIdFromResult(rc : RunContextServer, res : any) : number | string {
    const key = res[BaseDatastore._datastore.KEY]

    if(key.id) return Number(key.id)
    return key.name
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

  setId(id : number | string ) : void {
    this._id = id
  }

/*------------------------------------------------------------------------------
  - Set the primary key 
------------------------------------------------------------------------------*/                  
  setIdFromResult(rc : RunContextServer, res : any) : void {
    const id = BaseDatastore.getIdFromResult(rc, res)
    this._id = id
  }

/*------------------------------------------------------------------------------
  - Set the primary key 
------------------------------------------------------------------------------*/ 
  setIdFromKey(rc : RunContextServer, key : any) {
    if(key.id) this._id = Number(key.id)
    else this._id = key.name
  }

/*------------------------------------------------------------------------------
  - Create Query 
------------------------------------------------------------------------------*/
  static createQuery(rc : RunContextServer, transaction ?: DSTransaction) : DSQuery | DSTQuery  {
    if (!this._kindName) rc.warn(rc.getName(this), 'KindName: ', this._kindName)

    const model : BaseDatastore =  new (this as any)()  
    
    if(transaction) return new DSTQuery(rc, transaction.getTransaction(rc), model.getNamespace(), this._kindName)
    return new DSQuery(rc, BaseDatastore._datastore, this._kindName, model)
  }

/*------------------------------------------------------------------------------
  - Create Transaction 
------------------------------------------------------------------------------*/
  static createTransaction(rc : RunContextServer) : DSTransaction {
    const model : BaseDatastore =  new (this as any)()
    
    return new DSTransaction(rc, BaseDatastore._datastore, model.getNamespace())
  }

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                            UTILITY FUNCTIONS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

/*------------------------------------------------------------------------------
  - Unique params are identified and set as a primary key in a different
    collection to avoid duplication
  - Unique params are defined in the model
------------------------------------------------------------------------------*/
async setUnique(rc : RunContextServer, ignoreDupRec ?: boolean) : Promise<boolean> {
  const uniqueConstraints : any    = this.getUniqueConstraints(rc),
        kindName          : string = (<any>this)._kindName || (this.constructor as any)._kindName

  for(const constraint of uniqueConstraints) {
    let uniqueEntityKey = this.getDatastoreKey(rc, (<any>this)[constraint], true)
    try {
      await BaseDatastore._datastore.insert({key: uniqueEntityKey, data: ''})
    }
    catch (err) {
      if(!ignoreDupRec) {
        rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
        if (err.toString().split(':')[1] !== ' entity already exists') {
          throw(new DSError(ERROR_CODES.GCP_ERROR, err.message))
        } else {
           rc.isError() && rc.error(rc.getName(this), ERROR_CODES.UNIQUE_KEY_EXISTS)
        }
      } else {
        return false
      }
    }
  }
  return true
}

/*------------------------------------------------------------------------------
- The unique keys are to be deleted when the corresponding entity is deleted
------------------------------------------------------------------------------*/
async deleteUnique(rc : RunContextServer) : Promise<boolean> {
  const uniqueConstraints : any    = this.getUniqueConstraints(rc),
        kindName          : string = (<any>this)._kindName || (this.constructor as any)._kindName

  for(const constraint of uniqueConstraints) {
    let uniqueEntityKey = this.getDatastoreKey(rc, (<any>this)[constraint], true)
    try {
      BaseDatastore._datastore.delete(rc, uniqueEntityKey)
    } catch (err) {
      rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      throw(new DSError(ERROR_CODES.GCP_ERROR, err.message))
    }
  }
  return true
}

/*------------------------------------------------------------------------------
  - Create the datastore key from the id, kindName and parent key path
  - Key should be in the format
    {
      namespace : 'namespace',
      path      : [The complete path]
    }
------------------------------------------------------------------------------*/
getDatastoreKey(rc : RunContextServer, id ?: number | string | null , unique ?: boolean, parentKey ?: any) {
  let datastoreKey
  if(!id) id = this._id
  let kindName = (<any>this)._kindName || (this.constructor as any)._kindName
  if(unique) kindName += '_unique'
  if(!parentKey) {
    datastoreKey = BaseDatastore._datastore.key({
      namespace : this.getNamespace(),
      path      : ([kindName, id]) 
    })
  } else {
    datastoreKey = BaseDatastore._datastore.key({
      namespace : this.getNamespace(),
      path      : (parentKey.path.concat([kindName, id]))
    })
  }
  return datastoreKey
}

/*------------------------------------------------------------------------------
  - Deserialize: Assign the values of the object passed to the respective fields
------------------------------------------------------------------------------*/
deserialize (rc : RunContextServer, value : any) {
  
  if(!this._id) this._id = BaseDatastore.getIdFromResult(rc, value)

  for (let prop in value) { 
    let val     = value[prop],
        dVal    = (<any>this)[prop]
    
    if (prop.substr(0, 1) === '_' || val === undefined || val instanceof Function) continue
    
    if (dVal && typeof(dVal) === 'object' && dVal.deserialize instanceof Function) {
      (<any>this)[prop] = dVal.deserialize(val)
    } else {
      (<any>this)[prop] = val
    }
  }
  return this
}

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                            INTERNAL FUNCTIONS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
  
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
  - Serialize is towards Datastore. Need to convert it to Data format
------------------------------------------------------------------------------*/
  private serialize(rc : RunContextServer, value : any) : Array<{name : string, value : any, excludeFromIndexes : boolean}> { 
    const rec = []

    for(let prop in value) { 
      const indexedFields = BaseDatastore._indexedFields.concat(this.getIndexedFields(rc))
      let   val           = value[prop]

      if (prop.substr(0, 1) === '_' || val === undefined || val instanceof Function) continue
      if (val && typeof(val) === 'object' && val.serialize instanceof Function)
        val = val.serialize(rc)

      rec.push({ name: prop, value: val, excludeFromIndexes: (indexedFields.indexOf(prop) === -1)})
    }
    return rec
  }
}