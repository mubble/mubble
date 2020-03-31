/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Mon May 21 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { Query as DsQuery, 
          QueryResult }                           from '@google-cloud/datastore/query'
import { DatastoreTransaction as DSTransaction }  from '@google-cloud/datastore/transaction'
import { Muds,
         DatastoreInt,
         DatastoreKey
       }                                          from './muds'
import { MudsBaseEntity,
         MudsBaseStruct
       }                                          from './muds-base-entity'
import { MudsManager,
         MudsEntityInfo
       }                                          from './muds-manager'
import { MudsUtil }                               from './muds-util'
import { Mubble }                                 from '@mubble/core'
import { MudsQuery }                              from './muds-query'
import { RunContextServer }                       from '../..'
import * as lo                                    from 'lodash'
import { CommitResponse }                         from '@google-cloud/datastore/request'

import Datastore = require('@google-cloud/datastore')

/**
 * This is the main class on Muds system. All the Datastore operations should 
 * originate from here.
 * 
 * We intend to introduce exact datatypes and derived datatypes based on use cases like geoCoord
 * 
 * 
 * 
 * Useful Links:
 * Basics: https://cloud.google.com/datastore/docs/concepts/entities
 * Limits: https://cloud.google.com/datastore/docs/concepts/limits
 * Project: https://github.com/googleapis/nodejs-datastore/
 * Node datastore ver 1.4: https://cloud.google.com/nodejs/docs/reference/datastore/1.4.x/Datastore
 * All Node docs: https://cloud.google.com/nodejs/docs/reference/libraries
 * Entity modelling: https://cloud.google.com/appengine/articles/modeling
 * 
 */

/**
 * 
 * Test cases:
 * - See if we are able to selectively index arrays
 * - Unique either needs to be implemented for array or disallowed
 * - A field that has multiple basic types, can it be indexed properly (will query work?)
 */

export abstract class MudsIo {

  protected datastore: Datastore
  readonly now: number
  protected upsertQueue: MudsBaseEntity[] = []
  readonly uniques: UniqCacheObj[] = []

  constructor(protected rc: RunContextServer,
    protected manager: MudsManager) {

    this.datastore = manager.getDatastore()
    this.now = Date.now()
  }


  /**
   * newStruct: When you want to create a new instance of MudsStruct
   * * It is essentially new of the class with basic checks
   */
  newStruct<T extends MudsBaseStruct>(Cls: Muds.IBaseStruct<T>): T {
    const struct = new Cls(this.rc, this)
    return struct
  }

  /**
   * getExistingEntity: Call only when you just wish to read entity (no updates)
   * * Call this api when you are certain that entity exists in ds as it throws Muds.Error.RNF
   */
  public async getExistingEntity<T extends MudsBaseEntity>(entityClass: Muds.IBaseEntity<T>,
    ...keys: (string | DatastoreInt)[]): Promise<T> {

    const { ancestorKeys, selfKey } = this.separateKeys(this.rc, entityClass, keys),
      [entity] = await this.getEntitiesInternal({ entityClass, ancestorKeys, selfKey })
    if (!entity) throw (Muds.Error.RNF)
    return entity
  }

  /**
   * getExistingEntity: Call only when you just wish to check presence and read entity (no updates)
   */
  public async getEntityIfExists<T extends MudsBaseEntity>(entityClass: Muds.IBaseEntity<T>,
    ...keys: (string | DatastoreInt)[]): Promise<T> {

    const { ancestorKeys, selfKey } = this.separateKeys(this.rc, entityClass, keys),
      [entity] = await this.getEntitiesInternal({ entityClass, ancestorKeys, selfKey })
    return entity
  }

  public getQueueBuilder(): QueueBuilder {
    return new QueueBuilder(this.rc, this)
  }

  public async getEntities(queueBuilder: QueueBuilder): Promise<(MudsBaseEntity | undefined)[]> {
    return await this.getEntitiesInternal(...queueBuilder.getAll())
  }

  private async getEntitiesInternal<T extends MudsBaseEntity>(...reqs: IEntityKey<T>[]): Promise<(T)[]> {

    const dsKeys: DatastoreKey[] = [],
      arResp: (T)[] = []

    for (const { entityClass, ancestorKeys, selfKey } of reqs) {
      dsKeys.push(this.buildKeyForDs(this.rc, entityClass,
        ancestorKeys, selfKey))
    }

    const exec = this.getExec(),
      [results] = await exec.get(dsKeys),
      resultObj = {} as Mubble.uObject<object>

    for (const result of results) {
      const rawKeys = (result as any)[this.datastore.KEY] as DatastoreKey,
        entityClass = this.getInfo(rawKeys.kind).cons,
        keysFromDs = this.extractKeyFromDs(this.rc, entityClass, result),
        strKey = JSON.stringify(keysFromDs)

      resultObj[strKey] = result
    }

    for (const { entityClass, ancestorKeys, selfKey } of reqs) {

      const strKey = JSON.stringify({ ancestorKeys, selfKey }),
        result = resultObj[strKey]

      if (!result) {
        arResp.push(this.getForInsert(entityClass, ...ancestorKeys, selfKey))
        continue
      }
      delete resultObj[strKey]
      arResp.push(new entityClass(this.rc, this, ancestorKeys, selfKey, result as any, true))
    }

    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), lo.isEmpty(resultObj))

    return arResp
  }

  /**
   * getForUpsert: Api to do insert or update on an entity
   * * Call this api to get editable entity either from ds or blank insertable copy
   * * This is just a convenience api (combination of getEntityIfExists / getForInsert)
   * * To check whether entity was fetched from ds: check entity.isFromDs()
   */
  async getForUpsert<T extends Muds.BaseEntity>(entityClass: Muds.IBaseEntity<T>,
    ...keys: (string | DatastoreInt)[]): Promise<T> {
    return (await this.getEntityIfExists(entityClass, ...keys)) ||
      this.getForInsert(entityClass, ...keys)
  }

  /**
   * getForInsert: When you want to insert a new record in ds
   * * This would typically be with the key that will be generated by DS
   * * or sometimes when you are creating child of a parent like 'comment'
   */
  getForInsert<T extends MudsBaseEntity>(entityClass: Muds.IBaseEntity<T>,
    ...keys: (string | DatastoreInt)[]): T {

    const { ancestorKeys, selfKey } = this.separateKeysForInsert(this.rc, entityClass, keys)
    return new entityClass(this.rc, this, ancestorKeys, selfKey)
  }

  enqueueForUpsert(entity: MudsBaseEntity) {
    this.upsertQueue.push(entity)
  }

  public async delete(...entities: MudsBaseEntity[]): Promise<void> {

    const qb = new QueueBuilder(this.rc, this)
    for (const entity of entities) {
      this.rc.isAssert() && this.rc.assert(this.rc.getName(this), entity.hasValidKey())
      qb.add(entity.getInfo().cons, ...entity.getFullKey())
    }
    return await this.deleteInternal(...qb.getAll())
  }

  public async deleteKeys(queueBuilder: QueueBuilder): Promise<void> {
    return await this.deleteInternal(...queueBuilder.getAll())
  }

  public query<T extends MudsBaseEntity>(entityClass: Muds.IBaseEntity<T>, 
          ...ancestorKeys : (string | DatastoreInt)[]): MudsQuery<T> {

    return new MudsQuery(this.rc, this,
      this.verifyAncestorKeys(this.rc, entityClass, ancestorKeys),
      entityClass)
  }

  public async getEntityBasedOnKeys(entityInfo : MudsEntityInfo, keys: any) : Promise<QueryResult> {
    const exec = this.getExec(),
          internalKeys = []

    for(const key of keys) { 
      internalKeys.push(this.buildKeyForDs(this.rc, entityInfo.cons, [], key))
    }
    const results = (await exec.get(internalKeys))[0] as Object[]
    return [results, { moreResults : "NO_MORE_RESULTS" }]
  }

  private async deleteInternal<T extends MudsBaseEntity>(
    ...reqs: IEntityKey<T>[]): Promise<void> {

    const exec = this.getExec(),
      dsRecs = []

    for (const { entityClass, ancestorKeys, selfKey } of reqs) {
      dsRecs.push(this.buildKeyForDs(this.rc, entityClass, ancestorKeys, selfKey))
    }
    const result = await exec.delete(dsRecs)
    /*
     [ { mutationResults: [ [Object], [Object], [Object], [Object], [Object] ],
    indexUpdates: 19 } ]
    */
    return
  }

  /* ---------------------------------------------------------------------------
    Abstract functions
  -----------------------------------------------------------------------------*/
  protected abstract getExec(): Datastore | DSTransaction
  abstract createQuery(entityName: string): DsQuery


  /* ---------------------------------------------------------------------------
   P R I V A T E    C O D E    S E C T I O N     B E L O W

   D O   N O T   A C C E S S   D I R E C T L Y
  -----------------------------------------------------------------------------*/

  /* 
  Data format:
  [{"mutationResults":[{"key":null,"version":"1568370561252000","conflictDetected":false},
                            {"key":{"path":[{"kind":"CurDevice","id":"5663461317017600","idType":"id"}],
                            "partitionId":{"projectId":"obopay-staging-9043c","namespaceId":""}},
                            "version":"1568370561252000","conflictDetected":false}],
                            "indexUpdates":2}]
    */
  protected async processUpsertQueue(rc: RunContextServer) {

    const exec              = this.getExec(),
          modifiedEntities  = [],
          dsRecs            = []

    if (!this.upsertQueue.length) return

    for (const entity of this.upsertQueue) {

      if (!entity.isModified()) continue

      dsRecs.push(entity.convertForUpsert(this.rc))
      modifiedEntities.push(entity)
    }

    if (!modifiedEntities.length) return

    await this.checkUnique(rc, ...modifiedEntities)

    const executedResults:void|[CommitResponse] = await exec.save(dsRecs)

    if(executedResults) {
      const results = executedResults[0].mutationResults
      for(const [index,result] of results.entries()) {
        rc.isAssert() && rc.assert(rc.getName(this), result)
        if(result.key) {
          modifiedEntities[index].commitUpsert(result.key.path)
        }
      }
    }

    this.upsertQueue = []

    //Remove key from cache after successful execution
    await this.removeUniquesFromCache(rc, modifiedEntities)
  }

  /* 
    This method will be called once the execution of the upsert called. 
    so that unique key will be removed once after success.
  */
  private async removeUniquesFromCache(rc:RunContextServer, entities:MudsBaseEntity[]) {
    const uniques = this.getAllUniques(rc, ...entities)
    if (!uniques.length) { return }

    const trRedis      = this.manager.getCacheReference(),
          multi        = trRedis.redisMulti()

    for (const uniqueVal of uniques) {
      const key = this.getCacheKey(rc, uniqueVal.entity.getInfo().entityName, uniqueVal.key, uniqueVal.value)
      multi.del(key)
    }
    await trRedis.execRedisMulti(multi)
  }

  /* ?????
    - maintain the list of unique fields MudsEntityInfo like {'a.b.c': [a, b, c]}.
    - existence CheckQuery : use muds instead of native.
    - UniqCacheObj class : where to put ?.
    - entityBase.getNestedField (should give undefined for opt structs) assert in struct is not optional.

    - redis todo list [ entityName.a.b.c.value ]
    - db to list []
  */

  // ???? TODO We need to throw when there is an error

  private async checkUnique(rc: RunContextServer, ...entities: MudsBaseEntity[]) {

    const uniques = this.getAllUniques(rc, ...entities)

    if (!uniques.length) return []

    //Lock entity in cache, if cache have the existed entity it will throw error.
    await this.lockEntityInCache(rc, uniques)
    
    //check entity based on key and value, If device have the value throw error.
    await this.checkEntityExistsInDS(rc,uniques)

    this.uniques.concat(uniques)
  }


  private async checkEntityExistsInDS(rc: RunContextServer, uniques: UniqCacheObj[]) {
    const queries = []

    for (const uniqCacheObj of uniques) {
      queries.push(this.existenceCheckQuery(rc, uniqCacheObj.entity, uniqCacheObj.key, uniqCacheObj.value))
    }

    const presentedFromDb = (await Promise.all(queries)).filter(entity => entity)

    if (presentedFromDb.length) {
      rc.isError() && rc.error(rc.getName(this), `from DB Unique Key Violation : ${JSON.stringify(presentedFromDb)}`)
      throw new Mubble.uError('ENTITY_EXISTS','Unique Key Violation :' +JSON.stringify(presentedFromDb))
    }
  }

  private getAllUniques(rc: RunContextServer, ...entities: MudsBaseEntity[]) {

    let uniqueValues = [] as UniqCacheObj[]

    for (const entity of entities) {

      const uniquesLength = MudsUtil.getUniques(rc, entity, uniqueValues)

      if (!uniquesLength) continue

      const oldUniqValues = [] as UniqCacheObj[]
      MudsUtil.getUniques(rc, entity, oldUniqValues)
      uniqueValues = lo.difference(uniqueValues, oldUniqValues)
    }

    return uniqueValues
  }

  private async lockEntityInCache(rc: RunContextServer, uniqueVals: any[]) {

    const trRedis      = this.manager.getCacheReference(),
          multi        = trRedis.redisMulti(),
          existingKeys = [] as any[]

    for (const uniqueVal of uniqueVals) {

      const key = this.getCacheKey(rc, uniqueVal.entity.getInfo().entityName, uniqueVal.key, uniqueVal.value)
      
      // Expires in 5 secs.
      multi.set(key, uniqueVal.value, 'EX', '5', 'NX')
    }

    const res = await trRedis.execRedisMulti(multi)

    res.forEach((val, index) => {
      if (!val) existingKeys.push(uniqueVals[index])
    })

    if(existingKeys.length) {
      for(const uniqCacheObj of uniqueVals){
        rc.isError() && rc.error(rc.getName(this), `from cache Unique Key Violation : ${uniqCacheObj.key}-${uniqCacheObj.value}`)
        throw new Mubble.uError('ENTITY_EXISTS',`Unique Key Violation :${uniqCacheObj.key}-${uniqCacheObj.value}`)
      }
    }
    return existingKeys
  }

  private getCacheKey(rc: RunContextServer, entityName: string, key: string, value: string) {
    return entityName + '.' + key + ':' + value
  }

  /* Check existence of the unique fields from ds */
  private async existenceCheckQuery(rc     : RunContextServer,
                                    entity : MudsBaseEntity,
                                    key    : string,
                                    value  : any) {

    const existedEntity = await Muds.direct(rc, async (mudsIo) => {

      const query = mudsIo.query(entity.getInfo().cons)
                    .filter(key, '=', value)
      
      const result = await query.run(1)

      return await result.getNext()
    })

    if(!existedEntity)  return
    
    const selfKey : any = entity.getSelfKey()
    if(selfKey) {
      if(existedEntity.getSelfKey().value === selfKey.value) {
        return
      }
    }

    return {key , value}
  }

  /* 
    ???? TODO: Need to fix this:
    1) Make it public 
    2) Let it work only on the passed entities
    3) May have problem with unique indexes. Ensure correctness
  */
  private async upsertImmediately(rc: RunContextServer, ...entities: MudsBaseEntity[]) {
    this.upsertQueue.push(...entities)
    await this.processUpsertQueue(rc)
  }

  protected async removeUniqFromCache(rc: RunContextServer) {
    const trRedis = this.manager.getCacheReference(),
      multi = trRedis.redisMulti()

    for (const uniq of this.uniques)
      multi.del(uniq.key)

    await trRedis.execRedisMulti(multi)
  }

  getInfo(entityClass: Function |
    Muds.IBaseStruct<MudsBaseStruct> |
    Muds.IBaseEntity<MudsBaseEntity> |
    string): MudsEntityInfo {
    return this.manager.getInfo(entityClass)
  }

  separateKeys<T extends Muds.BaseEntity>(rc: RunContextServer,
    entityClass: Muds.IBaseEntity<T>,
    keys: (string | DatastoreInt)[]) {

    const { ancestorKeys, selfKey } = this.separateKeysForInsert(rc, entityClass, keys)  
    if (selfKey === undefined) {
      throw ('Self key is not set')
    } else {
      return { ancestorKeys, selfKey }
    }
  }

  separateKeysForInsert<T extends Muds.BaseEntity>(rc: RunContextServer,
    entityClass: Muds.IBaseEntity<T>,
    keys: (string | DatastoreInt)[]) {

    const entityInfo = this.getInfo(entityClass),
      ancestorsInfo = entityInfo.ancestors

    rc.isAssert() && rc.assert(rc.getName(this), keys.length >= ancestorsInfo.length)
    const ancestorKeys = []

    for (const [index, info] of ancestorsInfo.entries()) {
      ancestorKeys.push(this.checkKeyType(rc, keys[index], info))
    }

    let selfKey
    if (keys.length === ancestorsInfo.length) {
      rc.isAssert() && rc.assert(rc.getName(this),
        entityInfo.keyType === Muds.Pk.None || entityInfo.keyType === Muds.Pk.Auto)
      selfKey = undefined
    } else {
      selfKey = this.checkKeyType(rc, keys[keys.length - 1], entityInfo)
    }

    Object.freeze(ancestorKeys)
    return { ancestorKeys, selfKey }
  }

  private checkKeyType(rc: RunContextServer, key: DatastoreInt | string, info: MudsEntityInfo) {

    const strKey = info.keyType === Muds.Pk.String ? key : (key as DatastoreInt).value
    rc.isAssert() && rc.assert(rc.getName(this), strKey &&
      typeof (strKey) === 'string', `KeyType Mismatch`)
    return key
  }

  buildKeyForDs<T extends Muds.BaseEntity>(rc: RunContextServer,
    entityClass: Muds.IBaseEntity<T>,
    ancestorKeys: (string | DatastoreInt)[],
    selfKey: string | DatastoreInt | undefined) {

    const keyPath: (string | DatastoreInt)[] = [],
      entityInfo = this.getInfo(entityClass)

    for (const [index, ancestor] of entityInfo.ancestors.entries()) {
      keyPath.push(ancestor.entityName, ancestorKeys[index])
    }

    keyPath.push(entityInfo.entityName)
    if (selfKey !== undefined) keyPath.push(selfKey)

    // console.log(`keyPath ${JSON.stringify(keyPath)}`)
    return this.datastore.key(keyPath)
  }

  extractKeyFromDs<T extends Muds.BaseEntity>(rc: RunContextServer,
    entityClass: Muds.IBaseEntity<T>,
    rec: Mubble.uObject<any>) {

    const entityInfo = this.getInfo(entityClass),
      ancestorsInfo = entityInfo.ancestors,
      ancestorKeys = [] as (string | DatastoreInt)[],
      key = rec[this.datastore.KEY as any] as DatastoreKey,
      keyPath = key.path

    rc.isAssert() && rc.assert(rc.getName(this), key.kind === entityInfo.entityName)
    rc.isAssert() && rc.assert(rc.getName(this),
      entityInfo.keyType === Muds.Pk.String ? key.name : key.id)
    rc.isAssert() && rc.assert(rc.getName(this),
      ancestorsInfo.length === (keyPath.length / 2) - 1)

    for (let index = 0; index < keyPath.length - 2; index = index + 2) {
      const kind = keyPath[index],
        subk = keyPath[index + 1],
        anc = ancestorsInfo[index / 2]

      rc.isAssert() && rc.assert(rc.getName(this), kind === anc.entityName)
      if (anc.keyType === Muds.Pk.String) {
        rc.isAssert() && rc.assert(rc.getName(this), typeof (subk) === 'string')
        ancestorKeys.push(subk as string)
      } else if (typeof (subk) === 'string') {
        ancestorKeys.push(Muds.getIntKey(subk))
      } else {
        rc.isAssert() && rc.assert(rc.getName(this), typeof (subk) === 'object' && subk.value)
        ancestorKeys.push(subk as DatastoreInt)
      }
    }

    const selfKey = entityInfo.keyType === Muds.Pk.String ? key.name as string :
      Muds.getIntKey(key.id as string)
    return { ancestorKeys, selfKey }
  }

  getRecordFromDs<T extends Muds.BaseEntity>(rc: RunContextServer,
    entityClass: Muds.IBaseEntity<T>,
    record: Mubble.uObject<any>, fullRec: boolean): T {

    const { ancestorKeys, selfKey } = this.extractKeyFromDs(rc, entityClass, record)
    return new entityClass(rc, this, ancestorKeys, selfKey, record, fullRec)
  }

  verifyAncestorKeys<T extends Muds.BaseEntity>(rc: RunContextServer,
    entityClass: Muds.IBaseEntity<T>,
    ancestorKeys: (string | DatastoreInt)[]) {

    const entityInfo = this.getInfo(entityClass),
      ancestorsInfo = entityInfo.ancestors,
      dsKeys = []

    //TODO (AJ): Check with Raghu
    if (!entityInfo.ancestors.length) {
      
      if(ancestorKeys.length){
        dsKeys.push(entityInfo.entityName, this.checkKeyType(rc, ancestorKeys[0], entityInfo))
        return this.datastore.key(dsKeys)
      }

      return null
    }

    rc.isAssert() && rc.assert(rc.getName(this), ancestorsInfo.length,
      'It is mandatory to have ancestorKeys for querying with-in transaction')

    for (const [index, info] of ancestorsInfo.entries()) {

      //TODO(AD) : Verify this with raghu.
      if (ancestorKeys[index])
        dsKeys.push(info.entityName, this.checkKeyType(rc, ancestorKeys[index], info))
    }

    if(dsKeys.length) return this.datastore.key(dsKeys)

    return null
  }

  checkIndexed(rc: RunContextServer, dottedStr: string, entityName: string) {
    MudsUtil.checkIndexed(rc, this.manager.getInfoMap(), dottedStr, entityName)
  }

  getReferredField(rc: RunContextServer, dottedStr: string, entityName: string) {
    return MudsUtil.getReferredField(rc, this.manager.getInfoMap(), dottedStr, entityName)
  }

  destroy() {
    const thisObj = this as any
    thisObj.rc = null
    thisObj.datastore = null
    thisObj.manager = null
  }

}

/*------------------------------------------------------------------------------
   MudsDirectIo
--------------------------------------------------------------------------------*/
export class MudsDirectIo extends MudsIo {

  constructor(rc: RunContextServer,
    manager: MudsManager,
    private callback: (direct: Muds.DirectIo, now: number) => Promise<any>) {

    super(rc, manager)
  }

  public async run() {
    return await this.doCallback()
  }

  protected getExec(): Datastore | DSTransaction {
    return this.datastore
  }

  createQuery(entityName: string) {
    return this.datastore.createQuery(entityName)
  }

  private async doCallback() {

    const rc = this.rc
    try {
      const response = await this.callback(this, this.now)
      await this.processUpsertQueue(rc)
      return response
    } catch (err) {

      await this.removeUniqFromCache(rc)
      rc.isWarn() && rc.warn(rc.getName(this), 'Failed with error', err)
      throw err
    } finally {
      // reset all variables so that the transaction object cannot be used further
      //this.destroy()
    }

  }
}

/* ---------------------------------------------------------------------------
  MudsTransaction
-----------------------------------------------------------------------------*/
export class MudsTransaction extends MudsIo {

  private transaction: DSTransaction

  constructor(rc: RunContextServer,
    manager: MudsManager,
    private callback: (transaction: Muds.Transaction, now: number) => Promise<any>) {

    super(rc, manager)
  }

  public async run() {
    return await this.doCallback()
  }

  getExec(): Datastore | DSTransaction {
    return this.transaction
  }

  createQuery(entityName: string) {
    //Default Namespace, without this transaction wont work??
    return this.transaction.createQuery('', entityName)
  }

  private async doCallback() {

    const rc = this.rc

    this.transaction = this.datastore.transaction()
    await this.transaction.run()

    try {

      const response = await this.callback(this, this.now)
      if (this.upsertQueue.length) await this.processUpsertQueue(rc)
      await this.transaction.commit()
      rc.isDebug() && rc.debug(rc.getName(this), 'transaction completed')
      return response
    } catch (err) {

      // on certain errors doCallback can be run again
      // ????
      await this.removeUniqFromCache(rc)
      await this.transaction.rollback()
      rc.isWarn() && rc.warn(rc.getName(this), 'transaction failed with error', err)
      this.destroy()
      throw err
    } finally {

    }

    // reset all variables so that the transaction object cannot be used further

  }

  destroy() {
    super.destroy()

    const thisObj = this as any
    thisObj.transaction = null
  }
}

/* ---------------------------------------------------------------------------
  QueueBuilder
-----------------------------------------------------------------------------*/
export interface IEntityKey<T extends MudsBaseEntity> {
  entityClass: Muds.IBaseEntity<T>
  ancestorKeys: (string | DatastoreInt)[]
  selfKey: (string | DatastoreInt)
}

export class QueueBuilder {

  private arReq: IEntityKey<any>[] = []
  private reqObj: Mubble.uObject<string> = {}

  constructor(protected rc: RunContextServer,
    protected io: MudsIo) { }

  add<T extends MudsBaseEntity>(entityClass: Muds.IBaseEntity<T>,
    ...keys: (string | DatastoreInt)[]) {

    const { ancestorKeys, selfKey } = this.io.separateKeys(this.rc, entityClass, keys),
      req: IEntityKey<T> = { entityClass, ancestorKeys, selfKey },
      reqStr = JSON.stringify(req)

    this.arReq.push(req)

    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), !this.reqObj[reqStr],
      'Duplicate key in queue')
    this.reqObj[reqStr] = reqStr
    return this
  }

  getAll() {
    return this.arReq
  }
}

export class UniqCacheObj {
  entity: MudsBaseEntity
  key: string
  value: string
}
