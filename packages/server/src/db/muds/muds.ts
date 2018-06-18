/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Sat May 19 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as Datastore           from '@google-cloud/datastore'
import * as DsEntity            from '@google-cloud/datastore/entity'

import {  MudsBaseEntity,
          MudsBaseStruct }      from './muds-base-entity'
import {  MudsQuery }            from './muds-query'
import {  MudsManager }          from './muds-manager'
import {  RunContextServer }     from '../..'
import {  GcloudEnv }            from '../../gcp/gcloud-env'
import {  MudsTransaction, 
          MudsDirectIo }         from './muds-io'
import {  Mubble }               from '@mubble/core'
import {  DatastoreRequest }     from '@google-cloud/datastore/request';

export type DatastoreInt = DsEntity.DatastoreInt
export type DatastoreKey = DsEntity.DatastoreKey

export type DsRec = Object & {
  [name: string]: string | number | boolean | MudsBaseStruct | Array<any>
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
   * * subtype=Simple field types can be auto detected. Multiple types need to annotated like
   * * Muds.Subtype.string | Muds.Subtype.number etc. Array types always need to be annotated
   * * If a Field can have multiple EmbeddedEntity types, use Subtype as Muds.Subtype.embedded
   * 
   * * Level: property declaration
   */
  public static field(presence: Muds.Presence, subtype: Muds.TypeHint | Muds.BaseStruct = Muds.TypeHint.auto)
                      : (target: any, propertyKey: string) => void {
    return this.manager.registerField.bind(this.manager, {
              mandatory: presence === Muds.Man, subtype})
  }

  /**
   * * Marks a property for as indexed in datastore.
   * * Read documentation of Muds.field 
   * * For an indexed field, when presence is changed to 'false': we will need to run data migration
   * * Level: property declaration
   */
  public static indexed(presence:Muds.Presence, subtype: Muds.TypeHint | Muds.BaseStruct = Muds.TypeHint.auto)
                      : (target: any, propertyKey: string) => void {
    return this.manager.registerField.bind(this.manager, {
              mandatory: presence === Muds.Man, indexed: true, subtype})
  }

  /**
   * * Marks a property for as unique and indexed in datastore.
   * * Read documentation of Muds.field 
   * * For a unique field, presence value cannot become true, if it was false earlier
   * * Level: property declaration
   */
  public static unique(presence:Muds.Presence, subtype: Muds.TypeHint | Muds.BaseStruct = Muds.TypeHint.auto)
                      : (target: any, propertyKey: string) => void {
    return this.manager.registerField.bind(this.manager, {
              mandatory: presence === Muds.Man, indexed: true, unique: true, subtype})
  }

  /**
   * * Initialize Muds
   * * entities: All entities must be identified. To facilitate this list is taken as dummy input
   * * Level: property declaration
   */
  public static init(rc: RunContextServer, 
    gcloudEnv: GcloudEnv, ...entities: ({new(): Muds.BaseEntity}| Function)[]) {
    return this.manager.init(rc, gcloudEnv)
  }

  public static transaction(rc: RunContextServer, 
    callback: (transaction: Muds.Transaction, now: number) => Promise<boolean>): void {
    new MudsTransaction(rc, this.manager, callback)
  }

  public static direct(rc: RunContextServer, 
    callback ?: (directIo: Muds.DirectIo, now: number) => Promise<boolean>): void {
    new MudsDirectIo(rc, this.manager)
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

  static getManager() {
    return this.manager
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

  export type Man = 'mandatory'
  export type Opt = 'optional'
  export const Man = 'mandatory'
  export const Opt = 'optional'

  export type Asc = 'ascending'
  export type Dsc = 'descending'
  export const Asc = 'ascending'
  export const Dsc = 'descending'
  
  export type Presence = Muds.Man | Muds.Opt

  export interface IBaseStruct<T extends Muds.BaseStruct> {
    new(rc: RunContextServer, manager: MudsManager, 
        recObj ?: DsRec, fullRec ?: boolean): T
  }

  export interface IBaseEntity<T extends Muds.BaseEntity> {
    new(rc: RunContextServer, manager: MudsManager, 
          key ?: (string | DatastoreInt)[], recObj ?: DsRec, fullRec ?: boolean): T
  }

  export const Error = Object.freeze({
    RNF: 'RECORD_NOT_FOUND'
  })

  export enum TypeHint {
    auto        = 0, // detect automatically
    muds        = 1,
    string      = 2,
    number      = 4,
    boolean     = 8
  }
}
