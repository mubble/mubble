/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Mon May 21 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import * as Datastore                   from '@google-cloud/datastore'
import * as DsEntity                    from '@google-cloud/datastore/entity'
import { DatastoreTransaction }         from '@google-cloud/datastore/transaction'

import { Muds, DatastoreInt }           from './muds'
import { MudsBaseEntity }               from './muds-base-entity'
import { RunContextServer }             from '../..'
import { MudsManager, MudsEntityInfo }  from './muds-manager';

/**
 * This is the main class on Muds system. All the Datastore operations should 
 * originate from here.
 * 
 * 
 * 
 * 
 * 
 * Useful Links:
 * Basics: https://cloud.google.com/datastore/docs/concepts/entities
 * Limits: https://cloud.google.com/datastore/docs/concepts/limits
 * Project: https://github.com/googleapis/nodejs-datastore/
 * Node docs: https://cloud.google.com/nodejs/docs/reference/datastore/1.4.x/ (notice version in the url)
 * 
 */
export abstract class MudsIo {

  constructor(protected rc: RunContextServer, protected manager: MudsManager) {
  }


  // Call this api when you are certain that entity exists in ds
  async getExistingEntity<T extends MudsBaseEntity>(entityClass : Muds.IBaseEntity<T>, 
                 ...keys : (string | DatastoreInt)[]): Promise<T> {

    const dsKey = this.getDsKey(entityClass, keys),
          exec  = this.getExec()

    //await exec.get(dsKey)
    


                  
    const ds = this.manager.getDatastore()     
                   
    throw('Entity not found')
  }

  // Call this api to get entity from ds if it exists
  async getEntityIfExists<T extends MudsBaseEntity>(entityClass : Muds.IBaseEntity<T>, 
                 ...keys : (string | DatastoreInt)[]): Promise<T | undefined> {
    return undefined
  }

  // Call this api to get editable entity either from ds or blank insertable copy
  // This is just a convinience api (combination of getEntityIfExists and then getForInsert)
  async getForUpsert<T extends Muds.BaseEntity>(entityClass : Muds.IBaseEntity<T>, 
                    ...keys : (string | DatastoreInt)[]): Promise<T> {
    throw('Entity not found')
  }

  getForInsert<T extends MudsBaseEntity>(entityClass : Muds.IBaseEntity<T>, ...keys : (string | DatastoreInt)[]): T {
    return new entityClass(this.rc, Muds.getManager())
  }

  enqueueForUpsert(...entries: MudsBaseEntity[]) {

  }

  upsert(...entries: MudsBaseEntity[]) {

  }

  /* ---------------------------------------------------------------------------
    Abstract functions
  -----------------------------------------------------------------------------*/
  protected abstract getExec(): DsCommandExecuter
  

  /* ---------------------------------------------------------------------------
   P R I V A T E    C O D E    S E C T I O N     B E L O W

   D O   N O T   A C C E S S   D I R E C T L Y
  -----------------------------------------------------------------------------*/
  getDsKey<T extends Muds.BaseEntity>(entityClass : Muds.IBaseEntity<T>, keys: (string | DatastoreInt) []) {

    const entityInfo    = this.manager.getInfo(entityClass),
          ancestorsInfo = entityInfo.ancestors

    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), 
      keys.length >= ancestorsInfo.length)
    const ancestorKeys = []

    for (const [index, info] of ancestorsInfo.entries()) {
      ancestorKeys.push(this.checkKeyType(keys[index], info))
    }

    let selfKey
    if (keys.length === ancestorsInfo.length) {
      this.rc.isAssert() && this.rc.assert(this.rc.getName(this), entityInfo.keyType !== Muds.Pk.String)
      selfKey = undefined
    } else {
      selfKey = this.checkKeyType(keys[keys.length - 1], entityInfo)
    }

    return this.buildKey(entityInfo, ancestorKeys, selfKey)
  }

  private checkKeyType(key: DatastoreInt | string, info: MudsEntityInfo) {

    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), key.constructor === 
      (info.keyType === Muds.Pk.String ? String : DatastoreInt))

    return key
  }

  private buildKey(entityInfo: MudsEntityInfo, 
                   ancestorKeys: (string | DatastoreInt) [], 
                   selfKey: string | DatastoreInt | undefined) {

    const keyPath: (string | DatastoreInt)[] = []

    for (const [index, ancestor] of entityInfo.ancestors.entries()) {
      keyPath.push(ancestor.entityName, ancestorKeys[index])
    }

    keyPath.push(entityInfo.entityName)
    if (selfKey !== undefined) keyPath.push(selfKey)
    return keyPath
  }
  



}

export class MudsDirectIo extends MudsIo {
  protected getExec(): DsCommandExecuter {
    return this.manager.getDatastore()
  }
}

export class MudsTransaction extends MudsIo {

  private readonly transaction: DatastoreTransaction

  constructor(rc: RunContextServer, manager: MudsManager) {
    super(rc, manager)
    this.transaction = this.manager.getDatastore().transaction()
  }

  protected getExec(): DsCommandExecuter {
    return this.transaction
  }
}

export interface DsCommandExecuter {
  get(key: DsEntity.DatastoreKey): Promise<[object | undefined]>
}

