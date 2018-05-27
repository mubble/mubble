/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Sat May 19 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { MudsBaseEntity }       from './muds-base-entity'
import { MudsManager }          from './muds-manager'
import { RunContextServer }     from '../..'
import { GcloudEnv }            from '../../gcp/gcloud-env'
import { MudsTransaction }      from './muds-io'

export class Muds {

  private static manager = new MudsManager()

  /**
   * * Mandatory annotation to mark a class as Muds Entity
   * * Name of entity is fixed based on the class name. Entity classes cannot be minified or renamed
   * * Level: Class declaration
   */
  static entity(version: number, pkType: Muds.Pk): (target: any) => void {
    return this.manager.registerEntity.bind(this.manager, version, pkType)
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
   * * Marks a property for persistence in datastore.
   * * Optional fields, when left undefined, are not stored in the entity
   * * Optional=false (mandatory) field cannot be 'undefined' for update / insert. Muds would throw error
   * * Level: property declaration
   */
  static field(optional: boolean): (target: any, propertyKey: string) => void {
    return this.manager.registerField.bind(this.manager, {mandatory: !optional})
  }

  /**
   * * Marks a property for as indexed in datastore.
   * * For an indexed field, when optional is changed to 'false': we will need to run data migration
   * * Level: property declaration
   */
  static indexed(optional: boolean): (target: any, propertyKey: string) => void {
    return this.manager.registerField.bind(this.manager, {mandatory: !optional, indexed: true})
  }

  /**
   * * Marks a property for as unique and indexed in datastore.
   * * For a unique field, optional value cannot become true, if it was false earlier
   * * Level: property declaration
   */
  static unique(optional: boolean): (target: any, propertyKey: string) => void {
    return this.manager.registerField.bind(this.manager, {mandatory: !optional, indexed: true, unique: true})
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
    const tran = new MudsTransaction(rc, this.manager)
  }

}

export namespace Muds {

  export const BaseEntity  = MudsBaseEntity
  export type  BaseEntity  = MudsBaseEntity
  export const Transaction = MudsTransaction
  export type  Transaction = MudsTransaction

  export enum Pk {
    Auto,
    /**
     * ** WARNING ** Strongly discouraged when entity has no parent, 
     * contiguous numbers create hot tablets.
    */    
    Numeric, 
    String
  }

  export interface IBaseEntity<T extends Muds.BaseEntity> {
    new(rc: RunContextServer, manager: MudsManager): T
  }

}

