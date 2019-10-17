/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Sun Apr 09 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import * as cluster       from 'cluster'
import { Mubble }         from '@mubble/core'

export const CODE = {
  VOLUNTARY_DEATH      : 13
}

// Base class for all ipc messages
export abstract class BaseIpcMsg {
  constructor(public id: string) {

  } 

  send(worker: cluster.Worker | null): void {
    if (!worker) return
    worker.send(this)
  }
}

// Used to pass the initial startup params to worker
export class CWInitializeWorker extends BaseIpcMsg {

  constructor(public workerIndex  : number,
              public runMode      : number,
              public restartCount : number,
              public initObj      : Mubble.uObject<any>) {
    
    super(CWInitializeWorker.name)
  }
}

// Used when administrator wants to restart the service gracefully
export class CWRequestStop extends BaseIpcMsg {
  constructor() {
    super(CWRequestStop.name)
  }
}

// Used when memory goes up
export class WCRequestReplace extends BaseIpcMsg {
  constructor() {
    super(CWRequestStop.name)
  }
}
