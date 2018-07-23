/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Sat May 19 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {  
          MudsBaseEntity,
          IMudsCacheEntity,
          MudsBaseStruct
       }                                          from './muds-base-entity'
import {  
          MudsTransaction, 
          MudsDirectIo, 
          MudsIo
       }                                          from './muds-io'
import {  MudsQuery }                             from './muds-query'
import {  MudsManager }                           from './muds-manager'
import {  RunContextServer }                      from '../..'
import {  GcloudEnv }                             from '../../gcp/gcloud-env'
import {  Mubble }                                from '@mubble/core'
import {  MudsUtil }                              from './muds-util'
import {  RedisWrapper }                          from '../../cache/redis-wrapper'
import * as DsEntity                              from '@google-cloud/datastore/entity'

export type DatastoreInt = DsEntity.DatastoreInt
export type DatastoreKey = DsEntity.DatastoreKey

export type FieldType = StringConstructor   | 
                        BooleanConstructor  | 
                        NumberConstructor   | 
                        ObjectConstructor   | 
                        ArrayConstructor    | 
                        Muds.IBaseStruct<MudsBaseStruct>

export type ArrayField = StringConstructor  | 
                        NumberConstructor   | 
                        Muds.IBaseStruct<MudsBaseStruct>

export type DsRec = Object & {
  [name: string]:       string              | 
                        number              | 
                        boolean             | 
                        MudsBaseStruct      | 
                        Array<string        | number | MudsBaseStruct>
}

export enum EntityType {
  Dummy, Struct, Normal
}

export class Muds {

  private static manager = new MudsManager()

  /**
   * * Annotation to mark a class as Normal Muds Entity (Mandatory: one of entity / embeddedEntity / dummmy )
   * * Name of entity is fixed based on the class name. Entity classes cannot be minified or renamed
   * * Level: Class declaration
   */
  public static entity(version: number, pkType: Muds.Pk): (target: any) => void {
    return this.manager.registerEntity.bind(this.manager, version, pkType, EntityType.Normal)
  }
  
  /**
   * * Annotation to mark a class as Dummy Muds Entity (Mandatory: one of entity / embeddedEntity / dummmy )
   * * A dummy entity that is kept just to build the hierarchical ancestor chain.  No IO is permitted on them directly
   * * Level: Class declaration
   */
  public static dummy(pkType: Muds.Pk): (target: any) => void {
    return this.manager.registerEntity.bind(this.manager, 0, pkType, EntityType.Dummy)
  }

  /**
   * * Annotation to mark a class as Muds Struct (Mandatory: one of entity / Struct / dummmy )
   * * A struct allows field level validations when used in entity
   * * Level: Class declaration
   */
  public static struct(): (target: any) => void {
    return this.manager.registerEntity.bind(this.manager, 0, Muds.Pk.None, EntityType.Struct)
  }

  /**
   * * Optional annotation to provide ancestors of an entity
   * * You should list them in same order as in the key. Example => grandfather, father
   * * Level: Class declaration
   */
  public static ancestors(...modelNames: 
          (Function | {new (): Muds.BaseEntity})[]): (target: any) => void {
    return this.manager.registerAncestors.bind(this.manager, modelNames)
  }

  /**
   * * Optional annotation to provide composite indexes of an entity
   * * You should have a real good reason why you need this as composite indexes
   * * are sparingly available (total 200 for a project)
   * 
   * Pending
   * * Check presence of composite index before running a query
   * * Allow composite index on embedded entity
   * 
   * * Level: Class declaration
   */
  public static compositeIndex(idxObj: Mubble.uObject<Muds.Asc | Muds.Dsc>): (target: any) => void {
    return this.manager.registerCompositeIndex.bind(this.manager, idxObj)
  }
  

  /**
   * * Annotation to mark a field of Muds Entity (Mandatory: one of field / indexed / embedded entity )
   * * presence=Muds.Opt, field is optional. Muds.Man means that field should atleast be set null
   * * typeHint=Field type when it cannot be auto detected example Array
   * 
   * * Level: property declaration
   */
  public static field(presence: Muds.Presence, typeHint ?: ArrayField)
                      : (target: any, propertyKey: string) => void {
    return this.manager.registerField.bind(this.manager, {
              mandatory: presence === Muds.Man, typeHint})
  }

  /**
   * * Marks a property for as indexed in datastore.
   * * Read documentation of Muds.field 
   * * For an indexed field, when presence is changed to 'false': we will need to run data migration
   * * Level: property declaration
   */
  public static indexed(presence:Muds.Presence, typeHint ?: ArrayField)
                      : (target: any, propertyKey: string) => void {
    return this.manager.registerField.bind(this.manager, {
              mandatory: presence === Muds.Man, indexed: true, typeHint})
  }

  /**
   * * Marks a property for as unique and indexed in datastore.
   * * Read documentation of Muds.field 
   * * For a unique field, presence value cannot become true, if it was false earlier
   * * Level: property declaration
   */
  public static unique(presence:Muds.Presence, typeHint ?: ArrayField)
                      : (target: any, propertyKey: string) => void {
    return this.manager.registerField.bind(this.manager, {
              mandatory: presence === Muds.Man, indexed: true, unique: true, typeHint})
  }

  /**
   * * Initialize Muds
   * * entities: All entities must be identified. To facilitate this list is taken as dummy input
   * * Level: property declaration
   */
  public static init(rc          : RunContextServer, 
                     gcloudEnv   : GcloudEnv, 
                     trRedis     : RedisWrapper,
                     ...entities : ({new(): Muds.BaseEntity}| Function)[]) {

    return this.manager.init(rc, gcloudEnv, trRedis)
  }

  public static async transaction(rc: RunContextServer, 
    callback: (transaction: Muds.Transaction, now: number) => Promise<any>) {
    return await new MudsTransaction(rc, this.manager, callback).run()
  }

  public static async direct(rc: RunContextServer, 
    callback: (directIo: Muds.DirectIo, now: number) => Promise<any>) {
    return await new MudsDirectIo(rc, this.manager, callback).run()
  }

  /**
   * * Creates a numeric key that can be inserted into db
   * * As JS integer cannot handle full range of DS Integers, we only use 
   * * This api is given for consistency in handling keys
   */
  public static getIntKey(id: number | string): DatastoreInt {
    if (id === 0 || id === '0') throw('Zero is an invalid int key')
    return this.manager.getDatastore().int(id)
  }
}

export namespace Muds {

  export const BaseEntity   = MudsBaseEntity
  export type  BaseEntity   = MudsBaseEntity
  export const BaseStruct   = MudsBaseStruct
  export type  BaseStruct   = MudsBaseStruct
  export const Transaction  = MudsTransaction
  export type  Transaction  = MudsTransaction
  export const DirectIo     = MudsDirectIo
  export type  DirectIo     = MudsDirectIo
  export const Query        = MudsQuery
  export type  Query        = MudsQuery<MudsBaseEntity>
  export const getMpoc      = MudsUtil.getMpoc
  export type  ICacheEntity<T extends Muds.BaseEntity>  = IMudsCacheEntity<T>

  export enum Pk {
    None, // used for MudsStruct
    Auto,
    /**
     * ** WARNING ** Strongly discouraged when entity has no parent, 
     * contiguous numbers create hot tablets.
    */    
    Numeric, 
    String
  }

  export type Man  = 'mandatory'
  export type Opt  = 'optional'
  export const Man = 'mandatory'
  export const Opt = 'optional'

  export type Asc  = 'ascending'
  export type Dsc  = 'descending'
  export const Asc = 'ascending'
  export const Dsc = 'descending'
  
  export type Presence = Muds.Man | Muds.Opt

  export interface IBaseStruct<T extends Muds.BaseStruct> {
    new(rc: RunContextServer, io: MudsIo, 
        recObj ?: DsRec, fullRec ?: boolean): T
  }

  export interface IBaseEntity<T extends Muds.BaseEntity> {
    new(rc: RunContextServer, io: MudsIo, ancestorKey: (string | DatastoreInt)[],
          selfKey ?: (string | DatastoreInt), recObj ?: DsRec, fullRec ?: boolean): T
  }

  export const Error = Object.freeze({
    RNF: 'RECORD_NOT_FOUND'
  })
}
