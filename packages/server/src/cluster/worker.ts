/*------------------------------------------------------------------------------
   About      : This class hosts the server in clustered environment
   
   Created on : Mon Apr 10 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

// Import from node
import * as cluster       from 'cluster'

// Import from external modules with types
import * as _             from 'lodash'

// Internal imports
import * as ipc     from './ipc-message'
import {CONFIG}     from './config'

const CONST = {
  MS_WAIT_FOR_INIT: 30000
}

export class ClusterWorker {

  public  workerIndex         : number = -1
  private pendingInitResolve  : any
  private config              : CONFIG

  constructor() {
    if (clusterWorker) throw('ClusterWorker is singleton. It cannot be instantiated again')
  }

  async start(config: CONFIG) {

    if (cluster.isMaster) {
      throw('ClusterWorker cannot be started in the cluster.master process')
    }

    this.config = config
    process.on('message', this.onMessage.bind(this))

    return new Promise((resolve, reject) => {
      this.pendingInitResolve = resolve
      setTimeout(() => {
        if (this.pendingInitResolve) { // indicates promise is not fulfilled
          console.error('Could not get worker index in stipulated ms', CONST.MS_WAIT_FOR_INIT)
          process.exit(ipc.CODE.VOLUNTARY_DEATH)
        }
      }, CONST.MS_WAIT_FOR_INIT)
    })
  }

  onMessage(msg: any) {

    if (!_.isPlainObject(msg)) {
      return console.error('Received invalid message', msg)
    }

    switch (msg.id) {

    case ipc.CWInitializeWorker.name:
      this.workerIndex = msg.workerIndex
      process.title = this.config.SERVER_NAME + '_' + this.workerIndex
      const fn = this.pendingInitResolve
      this.pendingInitResolve = null
      fn() // resolve so that we can go ahead with further init
      console.log('Started worker with index', this.workerIndex)
      break
    }

  }
}

export const clusterWorker = new ClusterWorker()