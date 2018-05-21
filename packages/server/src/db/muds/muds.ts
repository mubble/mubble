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

  static entity(version: number, pkType: Muds.Pk): (target: any) => void {
    return this.manager.registerEntity.bind(this.manager, version, pkType)
  }

  static ancestors(...modelNames: string[]): (target: any) => void {
    return this.manager.registerAncestors.bind(this.manager, modelNames)
  }

  static field(optional: boolean): (target: any, propertyKey: string) => void {
    return this.manager.registerField.bind(this.manager, {mandatory: !optional})
  }

  static indexed(optional: boolean): (target: any, propertyKey: string) => void {
    return this.manager.registerField.bind(this.manager, {mandatory: !optional, indexed: true})
  }

  // 'Unique's are always indexed
  static unique(optional: boolean): (target: any, propertyKey: string) => void {
    return this.manager.registerField.bind(this.manager, {mandatory: !optional, indexed: true, unique: true})
  }

  static init(rc: RunContextServer, gcloudEnv: GcloudEnv) {
    return this.manager.init(rc, gcloudEnv)
  }

  static transaction(rc: RunContextServer, callback: (transaction: Muds.Transaction) => Promise<boolean>): void {
    const tran = new MudsTransaction(rc)
  }

}

export namespace Muds {

  export const BaseEntity  = MudsBaseEntity
  export type  BaseEntity  = MudsBaseEntity
  export const Transaction = MudsTransaction
  export type  Transaction = MudsTransaction

  export enum Pk {
    Auto,
    Numeric, // This is strongly discouraged, as contiguous numbers create hot tablets
    String
  }

}

