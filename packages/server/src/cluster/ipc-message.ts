/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Sun Apr 09 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import * as cluster       from 'cluster'

export const CODE = {
  VOLUNTARY_DEATH      : 13
}

export abstract class BaseIpcMsg {
  constructor(public id: string) {

  } 

  send(worker: cluster.Worker | null): void {
    if (!worker) return
    worker.send(this)
  }

}

export class CWInitializeWorker extends BaseIpcMsg {

  constructor(public workerIndex: number) {
    super(CWInitializeWorker.name)
  }

}

export class CWRequestStop extends BaseIpcMsg {

  constructor() {
    super(CWRequestStop.name)
  }

}



