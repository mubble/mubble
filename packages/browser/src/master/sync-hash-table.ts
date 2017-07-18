/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Tue Jul 18 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import Dexie                  from 'dexie'

import {  RunContextBrowser } from '@mubble/browser'

import {  SyncHashModel, 
          SyncModelResponse, 
          SyncRequest, 
          SyncResponse
        }                     from '@mubble/core'

import {  MasterDb }          from './master-db'

export class SyncHashTable {

  model : string
  hash  : SyncHashModel

  constructor(model: string, hash ?: SyncHashModel) {
    this.model = model
    this.hash  = hash || null
  }

  /**
  * Static functions
  */
  static async getAllHashes(rc: RunContextBrowser, db: MasterDb): Promise<SyncHashTable[]> {
    const ar = await db.syncHash.toArray()
    rc.isDebug() && rc.debug(rc.getName(this), 'Retrieved hashes from db, count:', ar.length)
    return ar
  }

  async save(db: MasterDb) {
    await db.transaction('rw', db.syncHash, async() => {
      await db.syncHash.put(this)
    })
  }
}
