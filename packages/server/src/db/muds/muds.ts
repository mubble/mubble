/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Sat May 19 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as Datastore           from '@google-cloud/datastore'
import * as DsEntity            from '@google-cloud/datastore/entity'

import { MudsBaseEntity }       from './muds-base-entity'
import { MudsQuery }            from './muds-query'
import { MudsManager }          from './muds-manager'
import { RunContextServer }     from '../..'
import { GcloudEnv }            from '../../gcp/gcloud-env'
import { MudsTransaction, 
         MudsDirectIo }         from './muds-io'
import { Mubble }               from '@mubble/core'
import { DatastoreRequest }     from '@google-cloud/datastore/request';

export type DatastoreInt = DsEntity.DatastoreInt
export type DatastoreKey = DsEntity.DatastoreKey

export type DsRec = Object & {
  [name: string]: string | number | boolean | Object | Array<any>
}


export class Muds {

  private static manager = new MudsManager()

  /**
   * * Mandatory annotation to mark a class as Muds Entity
   * * Name of entity is fixed based on the class name. Entity classes cannot be minified or renamed
   * * Level: Class declaration
   */
  static entity(version: number, pkType: Muds.Pk): (target: any) => void {
    return this.manager.registerEntity.bind(this.manager, version, pkType, false)
  }
  
  /**
   * * A dummy entity that is kept just to build the hierarchical ancestor chain
   * * Level: Class declaration
   */
  static dummy(pkType: Muds.Pk): (target: any) => void {
    return this.manager.registerEntity.bind(this.manager, 0, pkType, true)
  }
  
  /**
   * * Optional annotation to provide ancestors of an entity
   * * You should list them in same order as in the key. Example => grandfather, father
   * * Level: Class declaration
   */
  static ancestors(...modelNames: 
          (Function | {new (): Muds.BaseEntity})[]): (target: any) => void {
    return this.manager.registerAncestors.bind(this.manager, modelNames)
  }

  /**
   * * Optional annotation to provide composite indexes of an entity
   * * You should have a real good reason why you need this as composite indexes
   * * are sparingly available (total 200 for a project)
   * * Level: Class declaration
   */
  static compositeIndex(idxObj: Mubble.uObject<Muds.Asc | Muds.Dsc>): (target: any) => void {
    return this.manager.registerCompositeIndex.bind(this.manager, idxObj)
  }
  

  /**
   * * Marks a property for persistence in datastore.
   * * Optional fields, when left undefined, are not stored in the entity
   * * Optional=false (mandatory) field cannot be 'undefined' for update / insert. Muds would throw error
   * * Level: property declaration
   */
  static field(fieldType:Muds.FieldType = Muds.Man): (target: any, propertyKey: string) => void {
    return this.manager.registerField.bind(this.manager, {
              mandatory: fieldType === Muds.Man})
  }

  /**
   * * Marks a property for as indexed in datastore.
   * * For an indexed field, when optional is changed to 'false': we will need to run data migration
   * * Level: property declaration
   */
  static indexed(fieldType:Muds.FieldType = Muds.Man): (target: any, propertyKey: string) => void {
    return this.manager.registerField.bind(this.manager, {
              mandatory: fieldType === Muds.Man, indexed: true})
  }

  /**
   * * Marks a property for as unique and indexed in datastore.
   * * For a unique field, optional value cannot become true, if it was false earlier
   * * Level: property declaration
   */
  static unique(fieldType:Muds.FieldType = Muds.Man): (target: any, propertyKey: string) => void {
    return this.manager.registerField.bind(this.manager, {
              mandatory: fieldType === Muds.Man, indexed: true, unique: true})
  }

  static getManager() {
    return this.manager
  }

  /**
   * * Initialize Muds
   * * entities: All entities must be identified. To facilitate this list is taken as dummy input
   * * Level: property declaration
   */
  static init(rc: RunContextServer, gcloudEnv: GcloudEnv, ...entities: ({new(): Muds.BaseEntity}| Function)[]) {
    return this.manager.init(rc, gcloudEnv)
  }

  static transaction(rc: RunContextServer, callback: (transaction: Muds.Transaction, now: number) => Promise<boolean>): void {
    new MudsTransaction(rc, this.manager, callback)
  }

  static direct(rc: RunContextServer, callback ?: (directIo: Muds.DirectIo, now: number) => Promise<boolean>): void {
    new MudsDirectIo(rc, this.manager)
  }

  /**
   * * Creates a numeric key that can be inserted into db
   * * As JS integer cannot handle full range of DS Integers, we only use 
   * * This api is given for consistency in handling keys
   */
  static getIntKey(id: number | string): DatastoreInt {
    if (id === 0 || id === '0') throw('Zero is an invalid int key')
    return this.manager.getDatastore().int(id)
  }
}

export namespace Muds {

  export const BaseEntity   = MudsBaseEntity
  export type  BaseEntity   = MudsBaseEntity
  export const Transaction  = MudsTransaction
  export type  Transaction  = MudsTransaction
  export const DirectIo     = MudsDirectIo
  export type  DirectIo     = MudsDirectIo
  export const Query        = MudsQuery
  export type  Query        = MudsQuery<MudsBaseEntity>

  export enum Pk {
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
  
  export type FieldType = Muds.Man | Muds.Opt

  export interface IBaseEntity<T extends Muds.BaseEntity> {
    new(rc: RunContextServer, manager: MudsManager, 
        key ?: (string | DatastoreInt)[], recObj ?: DsRec): T
  }

  export const Error = {
    RNF: 'RECORD_NOT_FOUND'
  }

}

