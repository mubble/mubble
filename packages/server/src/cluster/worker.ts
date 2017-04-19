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

import {RunContext, RUN_MODE} from '../util/run-context'

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

  async start(rc: RunContext, config: CONFIG) {

    if (cluster.isMaster) {
      throw('ClusterWorker cannot be started in the cluster.master process')
    }

    this.config = config
    RunContext.on('ClusterMsg', process, 'message', this.onMessage.bind(this))

    return new Promise((resolve, reject) => {
      this.pendingInitResolve = resolve
      setTimeout(() => {
        if (this.pendingInitResolve) { // indicates promise is not fulfilled
          rc.isError() && rc.error(this.constructor.name, 'Could not get worker index in stipulated ms', CONST.MS_WAIT_FOR_INIT)
          process.exit(ipc.CODE.VOLUNTARY_DEATH)
        }
      }, CONST.MS_WAIT_FOR_INIT)
    })
  }

  onMessage(rc: RunContext, msg: any) {

    if (!_.isPlainObject(msg)) {
      return rc.isError() && rc.error(this.constructor.name, 'Received invalid message', msg)
    }

    switch (msg.id) {

    case ipc.CWInitializeWorker.name:
      this.workerIndex = msg.workerIndex
      process.title = this.config.SERVER_NAME + '_' + this.workerIndex
      const fn = this.pendingInitResolve
      this.pendingInitResolve = null
      fn() // resolve so that we can go ahead with further init
      rc.isStatus() && rc.status(this.constructor.name, 'Started worker with index', this.workerIndex)
      break
    }

  }

  voluntaryExit(rc: RunContext) {
    rc.isStatus() && rc.status(this.constructor.name, 'Voluntarily exiting the worker process')
    process.exit(ipc.CODE.VOLUNTARY_DEATH)
  }

  /*

  setupDebugging() {

    let _         = this,
        argv      = process.execArgv,
        heapdump

    if (!_.isDevMode()) return

    if (argv.length) {
      _.log('worker is running in debug flags', argv.join(' '))
    }

    if (argv.indexOf('--expose-gc') !== -1) {

      process.env.NODE_HEAPDUMP_OPTIONS = 'nosignal'
      try {
        heapdump  = require('heapdump')
      } catch (err) {
        console.log('To expose gc and heapdump please "npm install heapdump"')
        return
      }
      console.log('Run "kill -SIGUSR2 ' + process.pid + '" to force gc and heapdump', 'gc:' + typeof(global.gc))

      process.on('SIGUSR2', function() {
        global.gc()
        console.log('worker did gc')
        heapdump.writeSnapshot(function(err, filename) {
          console.log('heapdump written to ' + filename)
        })
      })
    }
  }

  msgToCluster(msg) {
//    let _ = this
//    _.trace('this is a trace log')
//    _.log('this is a info log')
//    _.warn('this is a warning')
//    _.error('this is a error log')
    process.send(msg)
  }

  postInit() {

    const _   = this

    uSecurity = require('./usecurity.js')
    uSecurity.postInit(_)

    setInterval(_.timerFunc.bind(_), CONST.WORKER_CHECK_SEC * 1000)

    process.on('uncaughtException', _.onError.bind(_))
    // const rm  = _.requestManager
    // _.log(rm)
    // process.on('unhandledRejection', _.onError.bind(_))
  }

  timerFunc() {

    const _ = this,
          reqMan    = _.requestManager,
          memInfo   = process.memoryUsage(),
          maxBytes  = (Number(_.env.MAX_RAM_GB) || 0) * Math.pow(10,9),
          now       = Date.now()

    try {
      _.requestManager.timeoutOldRequests()

      if (_.shutdownTime) {
        if (_.shutdownTime < now) {
          _.log({pid: process.pid, pendingRequests: reqMan.requests.length},
                'Shutting down server after max shutdown wait time')
          process.exit(CONST.VOLUNTARY_DEATH)
        }
        return
      }

      // _.trace('timerFunc called', memInfo)

      if (!maxBytes) return // memory check is disabled

      if (memInfo.rss > maxBytes) {

        if (!_.highMemTime) _.highMemTime = now

        _.trace('Observing high memory situation', { 
          memory          : memInfo, 
          pendingRequests : reqMan.requests.length, 
          startTime       : mu(new Date(_.highMemTime)).toString()
        })

        // we wait for 1 minute for GC to clear up memory
        if (_.highMemTime && ((now - _.highMemTime) > 60000)) {
          _.error('Saw high memory usage for a minute', memInfo.rss, '>',
                  maxBytes, 'Requesting substitution',
                  'Pending Requests:' + reqMan.requests.length)

          _.msgToCluster({id: IPC_MSG.WC_NEED_SUBSTITUTE})
        }

      } else if (_.highMemTime) {
        _.trace('Clearing high memory situation', { 
          memory          : memInfo, 
          pendingRequests : reqMan.requests.length, 
          highMemTime     : mu(new Date(_.highMemTime)).toString()
        })
        _.highMemTime = 0
      }
    } catch (err) {
      _.error(LOG_ID, 'timerFunc', err)
    }
  }

  onError() {

    let _     = this,
        args  = mu([]).clone(arguments)

    args.unshift('Worker received an error event. It will try to gracefully shutdown')
    _.error.apply(_, args)
    _.msgToCluster({id: IPC_MSG.WC_NEED_SUBSTITUTE})
  }

  stopTheWorker() {

    let _         = this, title

    if (_.shutdownTime !== 0) return

    _.shutdownTime = Date.now() + CONST.MAX_REQUEST_SEC * 1000

    if (_.socketServer) {
      _.socketServer.close()
      _.socketServer = null
    }

    if (_.httpServer) {
      _.httpServer.close(function(err) {
        if (err) {
          _.log('stopTheWorker encountered error', err)
        }
      })
      _.httpServer = null
    }

    if (_.kafkaClient) {
      _.kafkaClient.close()
      _.kafkaClient = null
    }

    _.setLogTag()
    title = _.serverName + '_' + _.workerIndex + '_' + 'hup'
    _.trace('stopTheWorker', 'New process title changed to', title)
    process.title = title
  }




  */
}
export const clusterWorker = new ClusterWorker()
