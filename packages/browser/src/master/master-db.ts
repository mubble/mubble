import Dexie                  from 'dexie'

import {  RunContextBrowser } from '@mubble/browser'

import {  SyncHashModel, 
          SyncModelResponse, 
          SyncRequest, 
          SyncResponse
        }                     from '@mubble/core'

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
    const ar = await db.hashes.toArray()
    rc.isDebug() && rc.debug(rc.getName(this), 'Retrieved hashes from db, count:', ar.length)
    return ar
  }

  async save(db: MasterDb) {
    await db.transaction('rw', db.hashes, async() => {
      await db.hashes.put(this)
    })
  }
}

export class MasterDb extends Dexie {

  hashes: Dexie.Table<SyncHashTable, string>

  constructor () {
    super('MasterDb')
    this.version(1).stores({
      hashes: 'model'
    })
    this.hashes.mapToClass(SyncHashTable)
  }
}

