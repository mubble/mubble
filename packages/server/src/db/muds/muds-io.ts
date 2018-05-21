/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Mon May 21 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import { Muds } from './muds'
import { MudsBaseEntity } from './muds-base-entity'
import { RunContextServer } from '../..'

export abstract class MudsIo {

  constructor(private rc : RunContextServer) {
  }

  // Call this api when you are certain that entity exists in ds
  async getExistingEntity<T extends MudsBaseEntity>(model : {new(): T}, 
                 ...keys : (string | number)[]): Promise<T> {
    throw('Entity not found')
  }

  // Call this api to get entity from ds if it exists
  async getEntityIfExists<T extends MudsBaseEntity>(model : {new(): T}, 
                 ...keys : (string | number)[]): Promise<T | undefined> {
    return undefined
  }

  // Call this api to get editable entity either from ds or blank insertable copy
  // This is just a convinience api (combination of getEntityIfExists and then getForInsert)
  async getForUpsert<T extends MudsBaseEntity>(model : {new(): T}, 
                    ...keys : (string | number)[]): Promise<T> {
    throw('Entity not found')
  }

  getForInsert<T extends MudsBaseEntity>(model : {new(): T}, ...keys : (string | number)[]): T {
    return new model()
  }

  enqueueForUpsert(...entries: MudsBaseEntity[]) {

  }

  upsert(...entries: MudsBaseEntity[]) {

  }


}

export class MudsDirectIo extends MudsIo {

}

export class MudsTransaction extends MudsIo {

}

