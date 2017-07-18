/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Sun Jul 16 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import {  SyncHashModel, 
          SyncModelResponse, 
          SyncRequest, 
          SyncResponse
        }                     from '@mubble/core'

import {  RunContextBrowser } from '@mubble/browser'

export class MasterManager {

  constructor(private rc: RunContextBrowser) {

  }

  getSyncHash() {
    return null
  }
}
