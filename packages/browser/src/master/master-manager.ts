/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Sun Jul 16 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import {  SyncHashModel, 
          SyncModelResponse, 
          SyncRequest, 
          SyncResponse,
          MASTER_UPDATE_EVENT
        }                     from '@mubble/core'

import {  RunContextBrowser,
          EventSystem 
        }                     from '@mubble/browser'

import {  SyncHashTable, 
          MasterDb 
        }                     from '.'

export class MasterManager {

  masterDb: MasterDb

  constructor(public rc: RunContextBrowser) {
    EventSystem.subscribe(MASTER_UPDATE_EVENT, this.onMasterUpdate.bind(this))
  }

  public getSyncHash() {
    return null
  }

  private async onMasterUpdate(event: any) {

    const syncResponse:SyncResponse = event.detail.data,
          rc:RunContextBrowser      = event.detail.rc

    for (const modelName of Object.keys(syncResponse)) {

      if (!(syncResponse as object).hasOwnProperty(modelName)) continue
      const modelData: SyncModelResponse = syncResponse[modelName]

      await this.applyMasterData(rc, modelName, modelData) 
    }
  }

  private async applyMasterData(rc: RunContextBrowser, modelName: string, modelData: SyncModelResponse) {

    if (modelData.purge) {
      await this.masterDb.clear(rc, modelName)
    } else if (modelData.del && modelData.del.length) {
      await this.masterDb.bulkDelete(rc, modelName, modelData.del)
    }

    if (modelData.mod && modelData.mod.length) {
      await this.masterDb.bulkPut(rc, modelName, modelData.mod)
    }

    const syncHash = new SyncHashTable(modelName, modelData.hash)
    await syncHash.save(this.masterDb)
  }

}
