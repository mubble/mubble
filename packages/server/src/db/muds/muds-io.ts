/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Mon May 21 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import * as Datastore       from '@google-cloud/datastore'
import { Muds }             from './muds'
import { MudsBaseEntity }   from './muds-base-entity'
import { RunContextServer } from '../..'
import { MudsManager }      from './muds-manager';

/**
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

  constructor(private rc: RunContextServer, private manager: MudsManager) {
  }


  // Call this api when you are certain that entity exists in ds
  async getExistingEntity<T extends MudsBaseEntity>(entityClass : Muds.IBaseEntity<T>, 
                 ...keys : (string | number)[]): Promise<T> {

                  
    const ds = this.manager.getDatastore()     
                   
    throw('Entity not found')
  }

  // Call this api to get entity from ds if it exists
  async getEntityIfExists<T extends MudsBaseEntity>(entityClass : Muds.IBaseEntity<T>, 
                 ...keys : (string | number)[]): Promise<T | undefined> {
    return undefined
  }

  // Call this api to get editable entity either from ds or blank insertable copy
  // This is just a convinience api (combination of getEntityIfExists and then getForInsert)
  async getForUpsert<T extends Muds.BaseEntity>(entityClass : Muds.IBaseEntity<T>, 
                    ...keys : (string | number)[]): Promise<T> {
    throw('Entity not found')
  }

  getForInsert<T extends MudsBaseEntity>(entityClass : Muds.IBaseEntity<T>, ...keys : (string | number)[]): T {
    return new entityClass(this.rc, Muds.getManager())
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

