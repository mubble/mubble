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
import {DSQuery}          from './ds-query'
import {DSTQuery}         from './dst-query'
import {DSTransaction}    from './ds-transaction'
import {RunContextServer} from '../../rc-server'
import * as lo            from 'lodash'
import { Mubble } from '@mubble/core';

const GLOBAL_NAMESPACE              : any    = undefined,
      MAX_DS_ITEMS_AT_A_TIME        : number = 450,
      MAX_DS_TRANSACTIONS_AT_A_TIME : number = 5


export type BASEDATASTORE_PROTECTED_FIELDS  =  'createTs' | 'deleted' | 'modUid' 
export type DATASTORE_COMPARISON_SYMBOL = '=' | '<' | '>' | '<=' |  '>='
export abstract class BaseDatastore<T extends BaseDatastore<T> = any> {

  // Common fields in all the tables
  protected _id              : number | string
  protected createTs         : number
  protected deleted          : boolean = false
     
  // holds most recent values for create, modify or delete
  public    modTs            : number
  protected modUid           : number

  // Static Variables
  protected static _kindName : string
  private static _namespace  : string

  static _datastore          : any
  static _autoFields         : Array<keyof BaseDatastore | BASEDATASTORE_PROTECTED_FIELDS> = ['createTs', 'deleted', 'modTs', 'modUid']
  static _indexedFields      : Array<keyof BaseDatastore | BASEDATASTORE_PROTECTED_FIELDS> = ['createTs', 'deleted', 'modTs']

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
  abstract getIndexedFields(rc : RunContextServer) : Array<keyof T | BASEDATASTORE_PROTECTED_FIELDS>

/*------------------------------------------------------------------------------
  - Get a list of Fields which need to be checked for Uniqueness across the entire Entity
  - Return Values is an array of
    - field Name in this Entity
  - Example: 
    return ['mobileNo', 'emailId']
------------------------------------------------------------------------------*/                  
  abstract getUniqueConstraints(rc : RunContextServer) : Array<keyof T>

/*------------------------------------------------------------------------------
  - Get a list of Fields which need to be checked for Uniqueness. 
  - The difference from the above is that these keys are prefixed by keyNames.
  - Return Values is an array of
    - field Name in this Entity
  - Example: 
    return ['mobileNo', 'emailId']
------------------------------------------------------------------------------*/                  
  getUniqueConstraintValues(rc : RunContextServer, updRec ?: any) : Array<string> {
    return []
  }

/*------------------------------------------------------------------------------
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
  static init(rc : RunContextServer, gcloudEnv : any) {
      if (gcloudEnv.authKey) {
        gcloudEnv.datastore = datastore({
          projectId   : gcloudEnv.projectId,
          credentials : gcloudEnv.authKey
        })
      } else {
        gcloudEnv.datastore = datastore({
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
public isGlobalNamespace(rc : RunContextServer) : boolean {
  return false
}

/*------------------------------------------------------------------------------
  - Get the namespace string depending upon whether namespace is global or local
------------------------------------------------------------------------------*/ 

public getNamespace(rc : RunContextServer) : string {
  return this.isGlobalNamespace(rc) ? GLOBAL_NAMESPACE : BaseDatastore._namespace
}

setNamespace(rc : RunContextServer, namespace : string) {
  BaseDatastore._namespace = namespace
}
/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                            BASIC DB OPERATIONS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */   


/*------------------------------------------------------------------------------
  - Get by primary key
------------------------------------------------------------------------------*/                  
  protected async get(rc : RunContextServer, id : number | string, ignoreRNF ?: boolean) : Promise<boolean> {
    const traceId = `${rc.getName(this)}:get:${this.constructor.name}`,
          ack     = rc.startTraceSpan(traceId)

    try {
      const key      = this.getDatastoreKey(rc, id),
            kindName = (<any>this)._kindName || (this.constructor as any)._kindName

      rc.assert (rc.getName (this), !!id, 'ID Cannot be Null/Undefined [Kind = ' + kindName + ']') 
      const entityRec = await BaseDatastore._datastore.get(key)

      if(!entityRec[0]) {
        if(ignoreRNF) return false
        throw(new DSError(ERROR_CODES.RECORD_NOT_FOUND, `Id: ${id}`))
      }  
      this.deserialize(rc, entityRec[0])
      return true

    } catch(err) {
      if(err.code) rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      else rc.isError() && rc.error(err)
      throw(new Error(ERROR_CODES.GCP_ERROR))
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
  }

/*------------------------------------------------------------------------------
  - Multi Get
------------------------------------------------------------------------------*/
  public static async mGet<T extends BaseDatastore<T>>(rc : RunContextServer, ignoreRNF : boolean, ...recs : T[] ) : Promise<boolean> {
    rc.isAssert() && rc.assert(rc.getName(this), !lo.isEmpty(recs), 'mGet models invalid')
    const models : T[] = lo.clone(recs) // Clone to ensure that the recs array is not spliced!
    while (models.length) {
      await this.mGetInternal(rc, ignoreRNF, ...models.splice(0, MAX_DS_ITEMS_AT_A_TIME))
    }
    return true
  }
  
  private static async mGetInternal<T extends BaseDatastore<T>>(rc : RunContextServer, ignoreRNF : boolean, ...models : T[]) : Promise<boolean> {
    const traceId = `${rc.getName(this)}:mget${models.length?':'+(models[0] as any).constructor.name :''}`,
          ack     = rc.startTraceSpan(traceId)
    let   result  : boolean         = true      
    try {
      const keys : any = []
      models.forEach((model : T) => {
        rc.isAssert() && rc.assert(rc.getName(this), model instanceof BaseDatastore, 'Model:', model, ', is not a valid BaseDataStore Model')
        rc.isAssert() && rc.assert(rc.getName(this), model.getId(rc), 'model id not set', model)

        keys.push(model.getDatastoreKey(rc, model.getId(rc)))
      })
      
      const res                   = await BaseDatastore._datastore.get(keys),
            entityRecords : any[] = res[0]
      
      if(entityRecords.length !== models.length) {
        if(!ignoreRNF) throw(new DSError(ERROR_CODES.RECORD_NOT_FOUND, `Keys: ${keys}`))
        result = false
      }

      for(let i = 0; i < entityRecords.length; i++) {
        const id : string | number = BaseDatastore.getIdFromResult(rc, entityRecords[i]) 
        // missing model result  are not present as undefined
        // we have to check the matching by id
        const model : any = models.find((mod : T) => {return mod.getId(rc) === id})
        rc.isAssert() && rc.assert(rc.getName(this), model, 'model not found for ', entityRecords[i][BaseDatastore._datastore.KEY])
        model.deserialize(rc , entityRecords[i])
      }
    } catch(err) {
      if(err.code) rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      else rc.isError() && rc.error(err)
      throw(new Error(ERROR_CODES.GCP_ERROR))
    } finally {
      rc.endTraceSpan(traceId , ack)
    }

    return result
  }

/*------------------------------------------------------------------------------
  - Multi Insert
------------------------------------------------------------------------------*/
  public static async mInsert<T extends BaseDatastore<T>>(rc : RunContextServer, insertTime : number | undefined, allowDupRec : boolean, ...recs : T[]) : Promise<boolean> {
    rc.isAssert() && rc.assert(rc.getName(this), !lo.isEmpty(recs), 'mInsert models invalid')
    const models : T[] = lo.clone(recs) // Clone to ensure that the recs array is not spliced!
    while (models.length) {
      await this.mInsertInternal(rc, insertTime, allowDupRec, ...models.splice(0, MAX_DS_TRANSACTIONS_AT_A_TIME))
    }
    return true
  }

  private static async mInsertInternal<T extends BaseDatastore<T>>(rc : RunContextServer, insertTime : number | undefined, allowDupRec : boolean, ...models : T[]) : Promise<boolean> {
    const traceId     = `${rc.getName(this)}:mInsert${models.length?':'+(models[0] as any).constructor.name :''}`,
          ack         = rc.startTraceSpan(traceId),
          transaction : DSTransaction<T> = this.createTransaction(rc)
  
    try {
      await transaction.start(rc)
      await transaction.mInsert(rc, insertTime, ...models)
      await transaction.commit(rc)
      return true
    } catch(err) {
      rc.isError() && rc.error(rc.getName(this), (err.code) ? '[Error Code:' + err.code + ']' : '', 'Error Message:', err.message)
      await transaction.rollback(rc)
      throw(new Error(ERROR_CODES.GCP_ERROR))
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
  }
  
/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  Blind Update, Use with Care! Not checking for Constraints!
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/
  public static async mUpdate<T extends BaseDatastore>(rc : RunContextServer, ...recs : T[] ) : Promise<boolean> {
    rc.isAssert() && rc.assert(rc.getName(this), !lo.isEmpty(recs), 'mUpdate models invalid')
    // this.hasUniqueChanged (rc, recs)  // TODO: [CG] Dont allow changing of unique keys!   
    const models : T[] = lo.clone(recs) // Clone to ensure that the recs array is not spliced!
    while (models.length) {
      await this.mUpdateInternal(rc, ...models.splice(0, MAX_DS_TRANSACTIONS_AT_A_TIME))
    }
    return true
  }
  
  private static async mUpdateInternal<T extends BaseDatastore<T>>(rc : RunContextServer, ...models : T[] ) : Promise<boolean> {
    const traceId     = `${rc.getName(this)}:mUpdate${models.length?':'+(models[0] as any).constructor.name :''}`,
          ack         = rc.startTraceSpan(traceId),
          transaction : DSTransaction<T> = this.createTransaction(rc) ,
          clones = models.map(m=>m.clone(rc , true))
    
    try {
      await transaction.start(rc)
      await transaction.mGet(rc, true, ...clones)
      for(const i in models){
        Object.assign(clones[i] , models[i])
      }
      await transaction.mUpdate(rc, ...clones)
      await transaction.commit(rc)
      return true
    } catch(err) {
      rc.isError() && rc.error(rc.getName(this), (err.code) ? '[Error Code:' + err.code + ']' : '', 'Error Message:', err.message)
      await transaction.rollback(rc)
      throw(new Error(ERROR_CODES.GCP_ERROR))
    } finally {
      rc.endTraceSpan(traceId,ack)
    }
  }

/*------------------------------------------------------------------------------
  - Multi Delete
------------------------------------------------------------------------------*/
  public static async mDelete<T extends BaseDatastore<T>>(rc : RunContextServer, ...recs : T[]) : Promise<boolean> {
    rc.isAssert() && rc.assert(rc.getName(this), !lo.isEmpty(recs), 'mDelete models invalid')

    const models : T[] = lo.clone(recs) // Clone to ensure that the recs array is not spliced!
    while (models.length) {
      await this.mDeleteInternal(rc, ...models.splice(0, MAX_DS_TRANSACTIONS_AT_A_TIME))
    }
    return true
  }

  private static async mDeleteInternal<T extends BaseDatastore<T>>(rc : RunContextServer, ...models : T[]) : Promise<boolean> {
    const traceId     = `${rc.getName(this)}:mDelete`,
          ack         = rc.startTraceSpan(traceId),
          transaction : DSTransaction<T> = this.createTransaction(rc)

    try {
      await transaction.start(rc)
      await transaction.mDelete(rc, ...models)
      await transaction.commit(rc)
      return true
    } catch(err) {
      rc.isError() && rc.error(rc.getName(this), (err.code) ? '[Error Code:' + err.code + ']' : '', 'Error Message:', err.message)
      await transaction.rollback(rc)
      throw(new Error(ERROR_CODES.GCP_ERROR))
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
  }

/*------------------------------------------------------------------------------
  - Multi Soft Delete
------------------------------------------------------------------------------*/
  public static async mSoftDelete<T extends BaseDatastore<T>>(rc : RunContextServer, ...recs : T[]) : Promise<boolean> {
    rc.isAssert() && rc.assert(rc.getName(this), !lo.isEmpty(recs), 'mSoftDelete models invalid')

    const models : T[] = lo.clone(recs) // Clone to ensure that the recs array is not spliced!
    while (models.length) {
      await this.mSoftDeleteInternal(rc, ...models.splice(0, MAX_DS_TRANSACTIONS_AT_A_TIME))
    }
    return true
  }

  private static async mSoftDeleteInternal<T extends BaseDatastore<T>>(rc : RunContextServer, ...models : T[]) : Promise<boolean> {
    const traceId     = `${rc.getName(this)}:mDelete`,
          ack         = rc.startTraceSpan(traceId),
          transaction : DSTransaction<T> = this.createTransaction(rc)

    try {
      await transaction.start(rc)
      await transaction.mGet(rc, false, ...models)
      await transaction.mUniqueDelete(rc, ...models)
      for(const model of models) {
        model.deleted = true
      }
      await transaction.mUpdate(rc, ...models)
      await transaction.commit(rc)
      return true
    } catch(err) {
      rc.isError() && rc.error(rc.getName(this), (err.code) ? '[Error Code:' + err.code + ']' : '', 'Error Message:', err.message)
      await transaction.rollback(rc)
      throw(new Error(ERROR_CODES.GCP_ERROR))
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
  }

/*------------------------------------------------------------------------------
  - Insert to datastore 

  Parameters:
  - insertTime     = Default is now()
  - ignoreDupRec   = Default is true [Ignore Duplicates... Ignore the Duplicate Error]
  - noChildren     = Default is true [No Children]
------------------------------------------------------------------------------*/ 

  protected async insert(rc : RunContextServer, insertTime ?: number, allowDupRec ?: boolean) : Promise<boolean> {
    // Re-direction to DS Transaction!
    const traceId     = `${rc.getName(this)}:insert:${this.constructor.name}`,
          transaction : DSTransaction<BaseDatastore<T>> = (this.constructor as any).createTransaction(rc),
          ack         = rc.startTraceSpan(traceId)
    try {
      await transaction.start(rc)
      await transaction.insert(rc, this)
      await transaction.commit(rc)
      return true
    } catch(err) {
      if(err.name !== ERROR_CODES.UNIQUE_KEY_EXISTS) {
        rc.isWarn() && rc.warn(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      }
      await transaction.rollback (rc)
      throw err
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
  }

/*------------------------------------------------------------------------------
  - Update
------------------------------------------------------------------------------*/ 
  protected async update(rc : RunContextServer, id : number | string, updRec : Mubble.uChildObject<T> , ignoreRNF ?: boolean) : Promise<BaseDatastore<T>> {
    // Re-direction to DS Transaction!
    const traceId = `${rc.getName(this)}:update:${this.constructor.name}`,
          transaction : DSTransaction<BaseDatastore<T>> = (this.constructor as any).createTransaction(rc),
          ack     = rc.startTraceSpan(traceId)
    
    try {
      this._id = id
      await transaction.start(rc)
      await transaction.get(rc, this)
      await transaction.update(rc, this, updRec)
      await transaction.commit(rc)
      return this
    } 
    catch(err) {
      await transaction.rollback (rc)
      throw err
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
  }

/*------------------------------------------------------------------------------
  - Soft Delete
  - The 'deleted' param will be set as true
  - The unique param is deleted, if set
  - Optional params to be modified can be provided
------------------------------------------------------------------------------*/ 
  protected async softDelete(rc : RunContextServer, id : number | string, params ?: Mubble.uChildObject<T> , ignoreRNF ?: boolean) : Promise<boolean> {
    const traceId     = `${rc.getName(this)}:softDelete:${this.constructor.name}`,
          ack         = rc.startTraceSpan(traceId),
          transaction : DSTransaction<BaseDatastore<T>> = (this.constructor as any).createTransaction(rc)

    try {
      this._id = id
      await transaction.start(rc)
      await transaction.get(rc, this)
      await transaction.mUniqueDelete(rc, this)

      // TODO: Need to add the unique Constraint Fields with undefined value to params...
      this.deleted = true
      if(params) Object.assign(this, params)
      await transaction.update(rc, this) // Dont Check Constraints. mUniqueDelete Done...
      await transaction.commit (rc)
      return true
    } 
    catch(err) {
      rc.isError() && rc.error(rc.getName(this), '[Error Code:' + err.code + '], Error Message:', err.message)
      await transaction.rollback (rc)
      throw(new DSError(ERROR_CODES.GCP_ERROR, err.message))
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
  }

/*------------------------------------------------------------------------------
  - Get kind Name 
------------------------------------------------------------------------------*/ 
static getKindName(rc : RunContextServer) {
  return this._kindName
}

/*------------------------------------------------------------------------------
  - Get Create Ts
------------------------------------------------------------------------------*/ 
getCreateTs(rc: RunContextServer) {
  return this.createTs
}
  
/*------------------------------------------------------------------------------
  - Get deleted Flag
------------------------------------------------------------------------------*/ 
isDeleted(rc: RunContextServer) : boolean {
  return this.deleted
}
  
/*------------------------------------------------------------------------------
  - Get ID from result
  - ID is not returned while getting object or while querying
------------------------------------------------------------------------------*/
  static getIdFromResult(rc : RunContextServer, res : any) : number | string {
    if(res instanceof BaseDatastore && res._id) return res._id
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
  createQuery(rc : RunContextServer, transaction ?: DSTransaction<T>) : DSQuery<T> | DSTQuery<T>  {
    const kindname = (this.constructor as any)._kindName
    if (!kindname) rc.warn(rc.getName(this), 'KindName: ', kindname)

    const model : T = new (this.constructor as any)()
    
    if(transaction) return new DSTQuery<T>(rc, transaction.getTransaction(rc), model.getNamespace(rc), kindname)
    return new DSQuery<T>(rc, BaseDatastore._datastore, kindname, model)
  }

  static createQueryWithNamespace<T extends BaseDatastore>(rc : RunContextServer, namespace : string) : DSQuery<T>  {
    const model : BaseDatastore = new (this as any)()
    
    return new DSQuery(rc, BaseDatastore._datastore, this._kindName, model, namespace)
  }

/*------------------------------------------------------------------------------
  - Create Transaction 
------------------------------------------------------------------------------*/
  static createTransaction<T extends BaseDatastore<T> = any>(rc : RunContextServer) : DSTransaction<T> {
    const model : T = new (this as any)()

    return new DSTransaction(rc, this._datastore, model.getNamespace(rc), this._kindName)
  }

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                            UTILITY FUNCTIONS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

/*------------------------------------------------------------------------------
  - Unique params are identified and set as a primary key in a different
    collection to avoid duplication
  - Unique params are defined in the model
------------------------------------------------------------------------------*/
  static getUniqueEntities<T extends BaseDatastore<T>>(rc: RunContextServer, ...models : T[]) {
    let entities : {key : any, data : any}[] = []
    for(const model of models) {
      
      const uniqueConstraints                     = model.getUniqueConstraints(rc),
            kindName          : string            = (<any>model)._kindName || (model.constructor as any)._kindName,
            tEntities : {key : any, data : any}[] = lo.flatMap (uniqueConstraints , (prop) => {
              if((model as any)[prop] === undefined || (model as any)[prop] === null) return []
              const value = (model as any)[prop]
              return[{ key: model.getDatastoreKey(rc, value, true), data: ''}]
            })
      entities = entities.concat(tEntities)
      const uPrefixedConstraints : any = model.getUniqueConstraintValues (rc),
            tuEntities : {key : any, data : any}[]  = lo.flatMap (uPrefixedConstraints as string[], (propValue) => {
              if (propValue === undefined || propValue === null) return []
              return [ { key: model.getDatastoreKey(rc, propValue, true), data: ''} ]
            })
      entities = entities.concat(tuEntities)    
    }
    return entities
  }

  static getUniqueEntitiesForUpdate<T extends BaseDatastore<T>>(rc : RunContextServer, model: T , ...updRecs : any[]) {
    rc.isAssert() && rc.assert(rc.getName(this), !lo.isEmpty(updRecs) , 'CheckUnique: mUnique models invalid')
    const uniqueConstraints    : any = model.getUniqueConstraints(rc)
    let entities : {key : any, data : any}[] = []
    for(const updRec of updRecs) {
      const uPrefixedConstraints : any = model.getUniqueConstraintValues (rc, updRec)
      uniqueConstraints.forEach ((prop: string) => {
        if (prop in updRec && (model as any)[prop]) { // If Constraint Changes...
          throw(new DSError(ERROR_CODES.UNSUPPORTED_UPDATE_FIELDS, 'Unique Constraint Field has Changed, ' + 
              prop + ':' + (model as any)[prop] + '=>' + updRec[prop] + ', ID:' + model._id)) 
        }
        if (updRec[prop]) entities.push ({ key: model.getDatastoreKey(rc, updRec[prop], true), data: ''})
      })
      const tuEntities : {key : any, data : any}[]  = lo.flatMap (uPrefixedConstraints as string[], (propValue) => {
        if (propValue === undefined || propValue === null) return []
        return [ { key: model.getDatastoreKey(rc, propValue, true), data: ''} ]
      })
      entities = entities.concat  (tuEntities)
    }
    return entities
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
    // if(!id) throw new DSError(ERROR_CODES.ID_NOT_FOUND, `${id}`) // TODO : Investigate
    let kindName = (<any>this)._kindName || (this.constructor as any)._kindName
    if(unique) kindName += '_unique'
    if(!parentKey) {
      datastoreKey = BaseDatastore._datastore.key({
        namespace : this.getNamespace(rc),
        path      : ([kindName, id]) 
      })
    } else {
      datastoreKey = BaseDatastore._datastore.key({
        namespace : this.getNamespace(rc),
        path      : (parentKey.path.concat([kindName, id]))
      })
    }
    return datastoreKey
  }

/*------------------------------------------------------------------------------
  - Allocate Id
------------------------------------------------------------------------------*/
  async allocateId(rc : RunContextServer) {
    const incompleteKey = this.getDatastoreKey(rc),
          keys          = await BaseDatastore._datastore.allocateIds(incompleteKey, 1),
          newKey        = keys[0][0],
          id            = Number(newKey.id)

    this._id = id
    return id
  }

/*------------------------------------------------------------------------------
  - Deserialize: Assign the values of the object passed to the respective fields
------------------------------------------------------------------------------*/
  deserialize (rc : RunContextServer, value : T) {
    
    this._id = BaseDatastore.getIdFromResult(rc, value)

    for (let prop in value) { 
      let val     = value[prop],
          dVal    = (<any>this)[prop]
      
      if (prop.substr(0, 1) === '_' || val === undefined || typeof(val) === 'function' /*val instanceof Function*/) continue
      
      if (dVal && typeof(dVal) === 'object' && dVal.deserialize instanceof Function) {
        (<any>this)[prop] = dVal.deserialize(val)
      } else {
        (<any>this)[prop] = val
      }
    }
    return this
  }

  clone(rc : RunContextServer , onlyId ?: boolean  ) : T {
    const newInstance : T = new (this.constructor as any)(rc)
    newInstance._id = this._id
    if(!onlyId)newInstance.deserialize(rc , this as any)
    return newInstance
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
  getInsertRec(rc : RunContextServer, insertTime ?: number, insertRec ?: BaseDatastore<T> | BaseDatastore<T>[]) : Array<any> {
    let retArr : Array<any> = []
        
    insertRec  = insertRec  || (this as BaseDatastore<T>)
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
  getUpdateRec(rc : RunContextServer, updateRec ?: BaseDatastore<T> | BaseDatastore<T> [], updateTime ?: number) : Array<any> {
    let retArr : Array<{name : string, value : any, excludeFromIndexes : boolean}> = []
        
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
  private serialize(rc : RunContextServer, value : BaseDatastore<T>) : Array<{name : string, value : any, excludeFromIndexes : boolean}> { 
    const rec = []

    for(let prop in value) { 
      const indexedFields = [...BaseDatastore._indexedFields , ...this.getIndexedFields(rc)] 
      let   val           = (value as any)[prop]

      if (prop.substr(0, 1) === '_' || val === undefined || val instanceof Function) continue
      if (val && typeof(val) === 'object' && val.serialize instanceof Function)
        val = val.serialize(rc)

      rec.push({ name: prop, value: val, excludeFromIndexes: (indexedFields.indexOf(prop as any) === -1)})
    }
    return rec
  }
}