/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Mon May 21 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import * as Datastore                   from '@google-cloud/datastore'
import * as DsEntity                    from '@google-cloud/datastore/entity'
import { DatastoreTransaction }         from '@google-cloud/datastore/transaction'

import { Muds, DatastoreInt, 
         DatastoreKey }                 from './muds'
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

  protected datastore: Datastore
  constructor(protected rc: RunContextServer, protected manager: MudsManager) {
    this.datastore = manager.getDatastore()
  }


  // Call this api when you are certain that entity exists in ds
  async getExistingEntity<T extends MudsBaseEntity>(entityClass : Muds.IBaseEntity<T>, 
                 ...keys : (string | DatastoreInt)[]): Promise<T> {

    const entity = await this.getEntityIfExists(entityClass, ...keys)
    if (!entity) throw(Muds.Error.RNF)
    return entity
  }

  // Call this api to get entity from ds if it exists
  async getEntityIfExists<T extends MudsBaseEntity>(entityClass : Muds.IBaseEntity<T>, 
                 ...keys : (string | DatastoreInt)[]): Promise<T | undefined> {

    const dsKey   = this.manager.prepareKeyForDs(this.rc, entityClass, keys),
          exec    = this.getExec(),
          [rec]   = await exec.get(dsKey)

    if (!rec) return undefined
    const key = (rec as any)[this.datastore.KEY] as DatastoreKey
    
    return new entityClass(this.rc, this.manager, 
      this.extractKeyFromDs(entityClass, key), rec as any)
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
  extractKeyFromDs<T extends Muds.BaseEntity>(entityClass : Muds.IBaseEntity<T>, 
          key: DsEntity.DatastoreKey) : (string | DatastoreInt)[] {

    const entityInfo    = this.manager.getInfo(entityClass),
          ancestorsInfo = entityInfo.ancestors,
          arKey         = [] as (string | DatastoreInt)[]

    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), 
      key.kind === entityInfo.entityName)
    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), 
      entityInfo.keyType === Muds.Pk.String ? key.name : key.id)
    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), 
      ancestorsInfo.length === (key.path.length / 2))

    for (let index = 0; index < key.path.length; index = index + 2) {
      const kind = key.path[index],
            subk = key.path[index + 1],
            anc  = ancestorsInfo[index / 2]

      this.rc.isAssert() && this.rc.assert(this.rc.getName(this), 
          kind === anc.entityName)
      if (anc.keyType === Muds.Pk.String) {
        this.rc.isAssert() && this.rc.assert(this.rc.getName(this), typeof(subk) === 'string')
        arKey.push(subk as string)
      } else if (typeof(subk) === 'string') {
        arKey.push(Muds.makeNumericKey(subk))
      } else {
        this.rc.isAssert() && this.rc.assert(this.rc.getName(this), typeof(subk) === 'object' && subk.value)
        arKey.push(subk as DatastoreInt)
      }
    }
    arKey.push(entityInfo.keyType === Muds.Pk.String ? key.name as string : 
      Muds.makeNumericKey(key.id as string))
    return arKey
  }
}

export class MudsDirectIo extends MudsIo {
  protected getExec(): DsCommandExecuter {
    return this.datastore
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

