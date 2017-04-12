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
import * as _             from 'lodash'

// Import from external modules without types
const posix:any = require('posix') // https://github.com/ohmu/node-posix

// Internal imports
import {Validator}  from '@mubble/core'
import * as ipc     from './ipc-message'
import {CONFIG}     from './config'

const RUN_MODE = {DEV: 'DEV', PROD: 'PROD'}

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
  
  async start(config: CONFIG) {

    if (!cluster.isMaster) {
      throw('ClusterMaster cannot be started in the cluster.worker process')
    }

    this.config = config
    this.validateConfig()

    // Set this process title to same as server name
    process.title  = this.config.SERVER_NAME

    // check if server is already running
    await this.checkRunning()

    // We capture the events at the master level, although we can also do it at the worker
    // level, this is to avoid receiving the events from the workers that have been removed 
    // from the workers array
    cluster.on('exit',    this.eventWorkerExit.bind(this))
    cluster.on('online',  this.eventWorkerOnline.bind(this))
    cluster.on('message', this.eventWorkerMessage.bind(this))

    // start Workers
    this.startWorkers()

    // wait forever as cluster master never returns
    await new Promise((resolve, reject) => {
    })
  }

  validateConfig(): void {

    const conf = this.config

    if (!Validator.isValidName(conf.SERVER_NAME)) {
      throw('Invalid server name: ' + conf.SERVER_NAME)
    }

    if (!(conf.RUN_MODE in RUN_MODE)) {
      throw('Invalid run mode: ' + conf.RUN_MODE)
    }

    if (!Validator.isValidName(conf.RUN_AS)) {
      throw('Invalid user name in RUN_AS: ' + conf.RUN_AS)
    }

    try {
      if (!(this.userInfo = posix.getpwnam(conf.RUN_AS))) {
        throw('library bug: posix.getpwnam did not return user info')
      }
    } catch(e) {
      console.error('posix.getpwnam', e)
      throw('Could not find the RUN_AS user name on system: ' + conf.RUN_AS)
    }

    // Figure out the user id that is used to start this process
    // If we have been started with sudo, need to find the sudoer
    const uid = process.getuid() === 0 ? Number(process.env.SUDO_UID) : process.getuid()

    if (this.userInfo.uid !== uid) {
      throw('You must run server from user-id: ' + conf.RUN_AS)
    }
  }

  async checkRunning () {

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
        console.log(e)
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

  createLockFile(lockFile:string) {

    fs.writeFileSync(lockFile, String(process.pid))
    if (!process.getuid() && this.userInfo) {
      fs.chownSync(lockFile, this.userInfo.uid, this.userInfo.gid)
    }
  }

  runCmdPS_P (cmd: string): Promise<string> {
    return this.execCmd(cmd).catch(() => {
      return ''
    })
  }
  

  execCmd (cmd: string): Promise<string> {

    return new Promise(function(resolve, reject) {
      childProcess.exec(cmd, function (err, stdout, stderr) {
        if (err) return reject(err)
        if (stderr) return reject(stderr)
        resolve(stdout)
      })
    })
  }

  startWorkers() {

    const conf      = this.config,
          argv      = process.execArgv,
          execArgv  = []
    
    if (conf.RUN_MODE === RUN_MODE.DEV) {
      if (argv.indexOf('--debug') !== -1) {
        execArgv.push(argv.indexOf('--debug-brk') === -1 ? '--debug' : '--debug-brk')
      }
      if (argv.indexOf('--expose-gc') !== -1) {
        execArgv.push('--expose-gc')
      }

      if (execArgv.length) {
        console.log('execArgv', execArgv)
        cluster.setupMaster({
          args: execArgv
        })
      }
    }

    const instances = conf.INSTANCES || 
                      conf.RUN_MODE === RUN_MODE.PROD ? os.cpus().length : 1

    for (let workerIndex: number = 0; workerIndex < instances; workerIndex++) {
      const workerInfo : WorkerInfo = new WorkerInfo(this, workerIndex)
      this.workers.push(workerInfo)
      workerInfo.fork()
    }                  
  }


  eventWorkerExit(worker: cluster.Worker, code: number, signal: string): void {

    // We wrap everything in try catch to avoid cluster from going down
    try {
      const [workerIndex, workerInfo] = this.findWorkerInfo(worker)
      if (!workerInfo) {
        return console.warn('Multiple notifications? Got exit message from a missing worker. forkId:', worker.id)
      }

      console.warn('Worker died', {exitCode: code, signal}, workerInfo)

      // If all the workers die voluntarily means server could not start
      if (code === ipc.CODE.VOLUNTARY_DEATH) {
        workerInfo.failed()
        if (this.workers.every((workerInfo: WorkerInfo) => workerInfo.state === WORKER_STATE.FAILED)) {
          console.error('Exiting cluster as all workers have failed to start')
          process.exit(1)
        }
      } else {
        workerInfo.substitute(true)
      }

    } catch (err) {
      console.error('cluster.on/exit - Caught global exception to avoid process shutdown: ' + err)
    }
  }

  eventWorkerOnline(worker: cluster.Worker): void {

    try {
      const [workerIndex, workerInfo] = this.findWorkerInfo(worker)
      if (!workerInfo) {
        return console.warn('Got online from a missing worker. forkId:', worker.id)
      }
      workerInfo.online()
    } catch (err) {
      console.error('cluster.on/exit - Caught global exception to avoid process shutdown: ' + err)
    }
  }

  eventWorkerMessage(worker: cluster.Worker, msg: any) : void {
    try {
      const [workerIndex, workerInfo] = this.findWorkerInfo(worker)
      if (!workerInfo) {
        return console.warn('Got msg from a missing worker. forkId:', worker.id, msg)
      }
      workerInfo.message(msg)
    } catch (err) {
      console.error('cluster.on/exit - Caught global exception to avoid process shutdown: ' + err)
    }
  }

  private findWorkerInfo(worker: cluster.Worker): [number, WorkerInfo | null] {
    const workerIndex = _.findIndex(this.workers, {forkId: worker.id})
    return workerIndex === -1 ? [-1, null] : [workerIndex, this.workers[workerIndex]]
  }

}

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

  constructor(readonly clusterMaster: ClusterMaster,
              readonly workerIndex  : number, // index of clusterMaster.workers
              ) {
  }

  // this is called when system has ascertained that the worker needs to be forked
  // either in case of fresh start, death, reload (code change or excessive memory usage) 
  public fork() {
    this.worker       = cluster.fork()
    this.forkId       = this.worker.id
    this.lastStartTS  = Date.now()
    this.state        = WORKER_STATE.STARTED
    console.log('Cluster: Forking worker with index', this.workerIndex)
  }

  private restart(): void {

    if (this.state !== WORKER_STATE.INIT) {
      return console.error('Restart requested in wrong state', this)
    }

    this.state = WORKER_STATE.START_WAIT
    const msToRestart = this.lastStartTS + CONST.MS_BETWEEN_RESTARTS - Date.now()
    setTimeout(() => {

      this.fork()
      this.restartCount++
      console.log('Restarted worker', this)

    }, msToRestart > 0 ? msToRestart : 0)
  }

  public online(): void {
    this.state = WORKER_STATE.ONLINE
    const msgObj = new ipc.CWInitializeWorker(this.workerIndex)
    msgObj.send(this.worker)
  }

  public failed(): void {
    this.worker = null
    this.forkId = '0'
    this.state = WORKER_STATE.FAILED
  }

  public substitute(onDeath: boolean): void {

    if (!onDeath) {
      const msgObj = new ipc.CWRequestStop()
      msgObj.send(this.worker)
    }

    this.state  = WORKER_STATE.INIT
    this.worker = null
    this.forkId = '0'

    onDeath ? this.restart() : this.fork()
  }

  public message(msg: any):void {

  }

  toString(): string {
    return `Worker #${this.workerIndex} state: ${this.state} forkId:${this.forkId}
started at:${this.lastStartTS} restarts:${this.restartCount}`
  }
}

export const clusterMaster = new ClusterMaster()
