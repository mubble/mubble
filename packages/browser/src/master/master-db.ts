import Dexie                  from 'dexie'

import {  RunContextBrowser } from '@mubble/browser'

import {  SyncHashModel, 
          SyncModelResponse, 
          SyncRequest, 
          SyncResponse
        }                     from '@mubble/core'

import { SyncHashTable }      from './sync-hash-table'

export abstract class MasterDb extends Dexie {

  tableMap: { [modelName: string] : Dexie.Table<any, any> } = {}

  syncHash: Dexie.Table<SyncHashTable, string>

  constructor () {
    super('MasterDb')
  }

  getSyncHashIndex() {
    return 'model'
  }

  async clear(rc: RunContextBrowser, modelName: string) {

    // await this.transaction('rw', db.synchash, async() => {
    //   await this.synchash.clear()
    // })

  }

  async bulkPut(rc: RunContextBrowser, modelName: string, arMod: object[]) {



  }

  async bulkDelete(rc: RunContextBrowser, modelName: string, arDel: object[]) {

    

  }
}


