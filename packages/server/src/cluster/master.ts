/*------------------------------------------------------------------------------
   About      : Starts the platform clustered. The cluster manager watches the 
                workers
   
   Created on : Thu Apr 06 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

// Import from node
import * as cluster       from 'cluster'
import * as crypto        from 'crypto'
import * as path          from 'path'
import * as os            from 'os'
import * as fs            from 'fs'
import * as childProcess  from 'child_process'

// Import from external modules with types
import * as lo            from 'lodash'

// Import from external modules without types
const posix:any = require('posix') // https://github.com/ohmu/node-posix

// Internal imports
import {Validator}        from '@mubble/core'
import * as ipc           from './ipc-message'
import {CONFIG}           from './config'
import {clusterWorker}    from './worker'

import {RunContextServer, RUN_MODE} from '../util/rc-server'

/**
 * This is the first API called. It start the platform with given configuration
 * @param minNodeVersion    Verify the node version before running
 * @param config            Configuration for the platform
 */

export async function startCluster( rc      : RunContextServer,
                                    config  : CONFIG) : Promise<boolean> {

  if (cluster.isMaster) {
    await clusterMaster.start(rc, config)
  } else {
    await clusterWorker.start(rc, config)
  }
  return cluster.isMaster
}


interface UserInfo {
  uid: number
  gid: number
}

/*------------------------------------------------------------------------------
  ClusterMaster
------------------------------------------------------------------------------*/
export class ClusterMaster {

  private workers:  WorkerInfo[]  = []
  private userInfo: UserInfo|null = null
  private config: CONFIG
  
  constructor() {
    if (clusterMaster) throw('ClusterMaster is singleton. It cannot be instantiated again')
  }
  
  async start(rc : RunContextServer, config: CONFIG) {

    if (!cluster.isMaster) {
      throw('ClusterMaster cannot be started in the cluster.worker process')
    }

    this.config = config
    rc.isDebug() && rc.debug(this.constructor.name, 'Starting cluster master with config', config)

    this.validateConfig(rc)

    // Set this process title to same as server name
    process.title  = this.config.SERVER_NAME

    // check if server is already running
    await this.checkRunning(rc)

    // We capture the events at the master level, although we can also do it at the worker
    // level, this is to avoid receiving the events from the workers that have been removed 
    // from the workers array
    rc.on('ExitMsg',    cluster, 'exit',    this.eventWorkerExit.bind(this))
    rc.on('OnlMsg',     cluster, 'online',  this.eventWorkerOnline.bind(this))
    rc.on('ClusterMsg', cluster, 'message', this.eventWorkerMessage.bind(this))

    // start Workers
    this.startWorkers(rc)
  }

  validateConfig(rc : RunContextServer): void {

    const conf = this.config

    if (!Validator.isValidName(conf.SERVER_NAME)) {
      throw('Invalid server name: ' + conf.SERVER_NAME)
    }

    if (!Validator.isValidName(conf.RUN_AS)) {
      throw('Invalid user name in RUN_AS: ' + conf.RUN_AS)
    }

    try {
      if (!(this.userInfo = posix.getpwnam(conf.RUN_AS))) {
        throw('library bug: posix.getpwnam did not return user info')
      }
    } catch(e) {
      rc.isError() && rc.error(this.constructor.name, 'posix.getpwnam', e)
      throw('Could not find the RUN_AS user name on system: ' + conf.RUN_AS)
    }

    // Figure out the user id that is used to start this process
    // If we have been started with sudo, need to find the sudoer
    const uid = process.getuid() === 0 ? Number(process.env.SUDO_UID) : process.getuid()

    if (this.userInfo.uid !== uid) {
      throw('You must run server from user-id: ' + conf.RUN_AS)
    }
  }

  async checkRunning (rc : RunContextServer) {

    const serverName  = this.config.SERVER_NAME,
          fileName    = crypto.createHash('md5').update(serverName).digest('hex') + '_' + serverName,
          fullPath    = path.join( os.tmpdir(), fileName)

    // we create a file in temp folder with content as pid of the cluster process.
    // ps -p pid : lists the process with the pid

    try {
      fs.statSync(fullPath)
    } catch (e) {
      if (e.code === 'ENOENT') {
        return this.createLockFile(fullPath)
      } else {
        rc.isError() && rc.error(this.constructor.name, e)
        throw('checkRunning failed while fs.statSync on ' + fullPath)
      }
    }

    // If we are here, means file exists
    const strPid:string = fs.readFileSync(fullPath, 'utf8'),
          out:string    = await this.runCmdPS_P('ps -p ' + strPid)

    if (out.indexOf(serverName) !== -1) {
      throw('Server is already running with pid: ' + strPid)
    }

    // All well, let's create the lock file
    this.createLockFile(fullPath)
  }

  private createLockFile(lockFile:string) {

    fs.writeFileSync(lockFile, String(process.pid))
    if (!process.getuid() && this.userInfo) {
      fs.chownSync(lockFile, this.userInfo.uid, this.userInfo.gid)
    }
  }

  private runCmdPS_P (cmd: string): Promise<string> {
    return this.execCmd(cmd).catch(() => {
      return ''
    })
  }
  

  private execCmd (cmd: string): Promise<string> {

    return new Promise(function(resolve, reject) {
      childProcess.exec(cmd, function (err, stdout, stderr) {
        if (err) return reject(err)
        if (stderr) return reject(stderr)
        resolve(stdout)
      })
    })
  }

  startWorkers(rc : RunContextServer) {

    const conf      = this.config,
          argv      = process.execArgv,
          execArgv  = []
    
    if (rc.getRunMode() === RUN_MODE.DEV) {
      if (argv.indexOf('--debug') !== -1) {
        execArgv.push(argv.indexOf('--debug-brk') === -1 ? '--debug' : '--debug-brk')
      }
      if (argv.indexOf('--expose-gc') !== -1) {
        execArgv.push('--expose-gc')
      }

      if (execArgv.length) {
        rc.isDebug() && rc.debug(this.constructor.name, 'execArgv', execArgv)
        cluster.setupMaster({
          args: execArgv
        })
      }
    }

    const instances = conf.INSTANCES || 
                      (rc.getRunMode() === RUN_MODE.PROD ? os.cpus().length : 1)

    for (let workerIndex: number = 0; workerIndex < instances; workerIndex++) {
      const workerInfo : WorkerInfo = new WorkerInfo(rc, this, workerIndex)
      this.workers.push(workerInfo)
      workerInfo.fork(rc)
    }                  
  }


  eventWorkerExit(rc: RunContextServer, worker: cluster.Worker, code: number, signal: string): any {

    // This is typically when worker has decided to exit, clusterManager is always aware of these
    // situations. Hence no action here
    if (code === ipc.CODE.VOLUNTARY_DEATH) return

    // We wrap everything in try catch to avoid cluster from going down
    const [workerIndex, workerInfo] = this.findWorkerInfo(worker)
    try {
      if (!workerInfo) {
        return rc.isWarn() && rc.warn(this.constructor.name, 'Multiple notifications? Got exit message from a missing worker. forkId:', worker.id)
      }

      rc.isWarn() && rc.warn(this.constructor.name, 'Worker died', {exitCode: code, signal}, workerInfo)

      // If all the workers die voluntarily means server could not start
      workerInfo.substitute(rc, true)

    } catch (err) {
      rc.isError() && rc.error(this.constructor.name, 'cluster.on/exit - Caught global exception to avoid process shutdown: ', err)
    }
  }

  eventWorkerOnline(rc: RunContextServer, worker: cluster.Worker): any {
    try {
      const [workerIndex, workerInfo] = this.findWorkerInfo(worker)
      if (!workerInfo) {
        return rc.isWarn() && rc.warn(this.constructor.name, 'Got online from a missing worker. forkId:', worker.id)
      }
      workerInfo.online(rc)
    } catch (err) {
      rc.isError() && rc.error(this.constructor.name, 'cluster.on/exit - Caught global exception to avoid process shutdown: ', err)
    }
  }

  eventWorkerMessage(rc: RunContextServer, worker: cluster.Worker, msg: any) : any {

    const [workerIndex, workerInfo] = this.findWorkerInfo(worker)
    try {
      if (!workerInfo) {
        return rc.isWarn() && rc.warn(this.constructor.name, 'Got msg from a missing worker. forkId:', worker.id, msg)
      }
      workerInfo.message(rc, msg)
    } catch (err) {
      rc.isError() && rc.error(this.constructor.name, 'cluster.on/exit - Caught global exception to avoid process shutdown: ', err)
    }
  }

  private findWorkerInfo(worker: cluster.Worker): [number, WorkerInfo | null] {
    const workerIndex = lo.findIndex(this.workers, {forkId: worker.id})
    return workerIndex === -1 ? [-1, null] : [workerIndex, this.workers[workerIndex]]
  }

}
export const clusterMaster = new ClusterMaster()

/*------------------------------------------------------------------------------
  WorkerInfo
------------------------------------------------------------------------------*/
enum WORKER_STATE { INIT,        // base INITIAL state (Fresh, to be restarted)
                    START_WAIT,  // RESTART pending
                    STARTED,     // Forked
                    ONLINE,      // Received ONLINE Message
                    FAILED
}

const CONST = {
  MS_BETWEEN_RESTARTS: 30 * 1000
}

class WorkerInfo {

  private worker        : cluster.Worker | null = null
  public  forkId        : string                = '0'
  private lastStartTS   : number                = 0
  private restartCount  : number                = 0
  public  state         : WORKER_STATE          = WORKER_STATE.INIT

  constructor(rc: RunContextServer, 
              readonly clusterMaster: ClusterMaster,
              readonly workerIndex  : number, // index of clusterMaster.workers
              ) {
  }

  // this is called when system has ascertained that the worker needs to be forked
  // either in case of fresh start, death, reload (code change or excessive memory usage) 
  public fork(rc: RunContextServer) {
    this.worker       = cluster.fork()
    this.forkId       = this.worker.id
    this.lastStartTS  = Date.now()
    this.state        = WORKER_STATE.STARTED
    rc.isDebug() && rc.debug(this.constructor.name, 'Forking worker with index', this.workerIndex)
  }

  private restart(rc: RunContextServer): any {

    if (this.state !== WORKER_STATE.INIT) {
      return rc.isError() && rc.error(this.constructor.name, 'Restart requested in wrong state', this)
    }

    this.state = WORKER_STATE.START_WAIT
    const msToRestart = this.lastStartTS + CONST.MS_BETWEEN_RESTARTS - Date.now()
    rc.setTimeout('StartTimer', (rc) => {

      this.fork(rc)
      this.restartCount++
      rc.isStatus() && rc.status(this.constructor.name, 'Restarted worker', this)

    }, msToRestart > 0 ? msToRestart : 0)
  }

  public online(rc: RunContextServer): void {
    this.state = WORKER_STATE.ONLINE
    const msgObj = new ipc.CWInitializeWorker(this.workerIndex)
    msgObj.send(this.worker)
  }

  public failed(rc: RunContextServer): void {
    this.worker = null
    this.forkId = '0'
    this.state = WORKER_STATE.FAILED
  }

  public substitute(rc: RunContextServer, onDeath: boolean): void {

    if (!onDeath) {
      const msgObj = new ipc.CWRequestStop()
      msgObj.send(this.worker)
    }

    this.state  = WORKER_STATE.INIT
    this.worker = null
    this.forkId = '0'

    onDeath ? this.restart(rc) : this.fork(rc)
  }

  public message(rc: RunContextServer, msg: any):void {

  }

  toString(): string {
    return `Worker #${this.workerIndex} state: ${this.state} forkId:${this.forkId}
started at:${this.lastStartTS} restarts:${this.restartCount}`
  }
}
