/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Mon May 21 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import * as Datastore                   from '@google-cloud/datastore'
import * as DsEntity                    from '@google-cloud/datastore/entity'
import { Query as DsQuery }             from '@google-cloud/datastore/query'
import { DatastoreTransaction 
           as DSTransaction }           from '@google-cloud/datastore/transaction'

import * as lo                          from 'lodash'
import { Mubble }                       from '@mubble/core'

import { Muds, DatastoreInt, 
         DatastoreKey }                 from './muds'
import { MudsBaseEntity }               from './muds-base-entity'
import { MudsQuery }                    from './muds-query'
import { RunContextServer }             from '../..'
import { MudsManager, MudsEntityInfo }  from './muds-manager'
import { extension } from 'mime-types';

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

  constructor(protected rc: RunContextServer, 
              protected manager: MudsManager) {
    this.datastore = manager.getDatastore()
    this.now = Date.now()
  }

  /**
   * getExistingEntity: Call only when you just wish to read entity (no updates)
   * * Call this api when you are certain that entity exists in ds as it throws Muds.Error.RNF
   */
  public async getExistingEntity<T extends MudsBaseEntity>(entityClass : Muds.IBaseEntity<T>, 
                 ...keys : (string | DatastoreInt)[]): Promise<T> {

    const {ancestorKeys, selfKey} = this.manager.separateKeys(this.rc, entityClass, keys),
          [entity] = await this.getEntitiesInternal({entityClass, ancestorKeys, selfKey})
    if (!entity) throw(Muds.Error.RNF)
    return entity
  }

  /**
   * getExistingEntity: Call only when you just wish to check presence and read entity (no updates)
   */
  public async getEntityIfExists<T extends MudsBaseEntity>(entityClass : Muds.IBaseEntity<T>, 
                 ...keys : (string | DatastoreInt)[]): Promise<T | undefined> {

    const {ancestorKeys, selfKey} = this.manager.separateKeys(this.rc, entityClass, keys),
          [entity] = await this.getEntitiesInternal({entityClass, ancestorKeys, selfKey})
    return entity
  }

  public getQueueBuilder(): QueueBuilder {
    return new QueueBuilder(this.rc, this.manager)
  }

  public async getEntities(queueBuilder: QueueBuilder): Promise< (MudsBaseEntity | undefined)[]> {
    return await this.getEntitiesInternal(...queueBuilder.getAll())
  }

  private async getEntitiesInternal<T extends MudsBaseEntity>(
    ...reqs: IEntityKey<T>[]): Promise< (T | undefined)[]> {

    const dsKeys  : DatastoreKey[] = [],
          arResp  : (T | undefined)[] = []

    for (const {entityClass, ancestorKeys, selfKey} of reqs) {
      dsKeys.push(this.manager.buildKey(this.rc, entityClass, 
                  ancestorKeys, selfKey))
    }

    const exec      = this.getExec(),
          [results] = await exec.get(dsKeys),
          resultObj = {} as Mubble.uObject<object>

    for (const result of results) {
      const rawKeys     = (result as any)[this.datastore.KEY] as DatastoreKey,
            entityClass = this.manager.getInfo(rawKeys.kind).cons,
            keysFromDs  = this.manager.extractKeyFromDs(this.rc, entityClass, result),
            strKey      = JSON.stringify(keysFromDs)

      console.log(strKey)
      resultObj[strKey] = result
    }

    for (const {entityClass, ancestorKeys, selfKey} of reqs) {

      const keys   = lo.clone(ancestorKeys)
      keys.push(selfKey)

      const strKey = JSON.stringify(keys),
            result = resultObj[strKey]
            
      if (!result) {
        arResp.push(undefined)
        continue
      }
      delete resultObj[strKey]
      arResp.push(new entityClass(this.rc, this.manager, keys, result as any))
    }

    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), lo.isEmpty(resultObj))
    return arResp
  }
  

  /**
   * getForUpsert: Api to do insert or update on an entity
   * * Call this api to get editable entity either from ds or blank insertable copy
   * * This is just a convinience api (combination of getEntityIfExists -> getForInsert -> edit)
   */
  async getForUpsert<T extends Muds.BaseEntity>(entityClass : Muds.IBaseEntity<T>, 
                    ...keys : (string | DatastoreInt)[]): Promise<T> {
    let entity = await this.getEntityIfExists(entityClass, ...keys)
    if (!entity) entity = new entityClass(this.rc, this.manager, keys)
    entity.edit()
    return entity
  }

  /**
   * getForInsert: When you want to insert a new record in ds
   * * This would typically be with the key that will be generated by DS
   * * or sometimes when you are creating child of a parent like 'comment'
   */
  getForInsert<T extends MudsBaseEntity>(entityClass : Muds.IBaseEntity<T>, 
                ...keys : (string | DatastoreInt)[]): T {

    const entity = new entityClass(this.rc, this.manager, keys.length ? keys : undefined)
    entity.edit()
    return entity
    }

  enqueueForUpsert(...entities: MudsBaseEntity[]) {

  }

  async upsert(...entities: MudsBaseEntity[]) {

    const exec     = this.getExec(),
          dsRecs   = []

    for (const entity of entities) {

      this.rc.isAssert() && this.rc.assert(this.rc.getName(this), entity.isEditing(),
        `${entity.getLogId()} Skipping entity not in edit mode`)

      this.rc.isAssert() && this.rc.assert(this.rc.getName(this), entity.isModified(),
        `${entity.getLogId()} Skipping entity as it is not modified`)

      dsRecs.push(this.manager.getRecordForUpsert(this.rc, entity))
    }

    /**
     * [ { mutationResults: [ [Object] ], indexUpdates: 3 } ]
     * mutationResults [ { key: { path: [Array], partitionId: [Object] }, version: '1527613238307000', conflictDetected: false } ]
     * key { path: 
              [ { kind: 'User', id: '1', idType: 'id' },
                { kind: 'KeyType', id: '2', idType: 'id' },
                { kind: 'UserKeyValue', id: '5629499534213120', idType: 'id' } ],
             partitionId: { projectId: 'mubble-playground', namespaceId: '' } 
           }
     */

    const results = await exec.upsert(dsRecs)
    for (const [index, result] of results.entries()) {

      const entity           = entities[index],
            [mutationResult] = result.mutationResults
            
      this.rc.isAssert() && this.rc.assert(this.rc.getName(this), 
        !mutationResult.conflictDetected, `${entity.getLogId()} had conflict`)

      entity.commitUpsert(mutationResult.key ? mutationResult.key.path : null)
      
    }
  }

  public async delete(...entities: (MudsBaseEntity)[]): Promise<void> {

    const qb = new QueueBuilder(this.rc, this.manager)
    for (const entity of entities) {
      this.rc.isAssert() && this.rc.assert(this.rc.getName(this), entity.hasValidKey())
      qb.add(entity.getInfo().cons, ...entity.getFullKey())
    }
    return await this.deleteInternal(...qb.getAll())
  }

  public async deleteKeys(queueBuilder: QueueBuilder): Promise<void> {
    return await this.deleteInternal(...queueBuilder.getAll())
  }

  private async deleteInternal<T extends MudsBaseEntity>(
    ...reqs: IEntityKey<T>[]): Promise<void> {

    const exec     = this.getExec(),
          dsRecs   = []

    for (const {entityClass, ancestorKeys, selfKey} of reqs) {
      dsRecs.push(this.manager.buildKey(this.rc, entityClass, ancestorKeys, selfKey))
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
  

  /* ---------------------------------------------------------------------------
   P R I V A T E    C O D E    S E C T I O N     B E L O W

   D O   N O T   A C C E S S   D I R E C T L Y
  -----------------------------------------------------------------------------*/

}

export class MudsDirectIo extends MudsIo {
  protected getExec(): Datastore | DSTransaction {
    return this.datastore
  }

  public query<T extends MudsBaseEntity>(entityClass: Muds.IBaseEntity<T>): MudsQuery<T> {
    return new MudsQuery(this.rc, this.manager, this.getExec(), null, entityClass)
  }
  
}

/* ---------------------------------------------------------------------------
  MudsTransaction
-----------------------------------------------------------------------------*/
export class MudsTransaction extends MudsIo {

  private readonly transaction: DSTransaction

  constructor(rc        : RunContextServer, 
              manager   : MudsManager, 
              private callback : (transaction: Muds.Transaction, now: number) => Promise<boolean>) {

    super(rc, manager)
    this.transaction = this.datastore.transaction()
    this.doCallback()
  }

  public query<T extends MudsBaseEntity>(entityClass: Muds.IBaseEntity<T>, 
          firstAncestorKey      : string | DatastoreInt,
          ...otherAncestorKeys  : (string | DatastoreInt)[]): MudsQuery<T> {

    otherAncestorKeys.unshift(firstAncestorKey) 
    return new MudsQuery(this.rc, this.manager, this.getExec(), 
      this.manager.verifyAncestorKeys(this.rc, entityClass, otherAncestorKeys),
      entityClass)
  }

  protected getExec(): Datastore | DSTransaction {
    return this.transaction
  }

  private doCallback() {
    this.callback(this, this.now)
  }
}

/* ---------------------------------------------------------------------------
  QueueBuilder
-----------------------------------------------------------------------------*/
export interface IEntityKey<T extends MudsBaseEntity> {
  entityClass   : Muds.IBaseEntity<T>
  ancestorKeys  : (string | DatastoreInt)[]
  selfKey       : (string | DatastoreInt)
}

export class QueueBuilder {

  private arReq: IEntityKey<any>[] = []
  private reqObj: Mubble.uObject<string> = {}

  constructor(protected rc: RunContextServer, 
              protected manager: MudsManager) {}

  add<T extends MudsBaseEntity>(entityClass : Muds.IBaseEntity<T>, 
    ...keys : (string | DatastoreInt)[]) {

    const {ancestorKeys, selfKey} = this.manager.separateKeys(this.rc, entityClass, keys),
          req: IEntityKey<T>      = {entityClass, ancestorKeys, selfKey},
          reqStr                  = JSON.stringify(req)
      
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
