/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Thu Apr 13 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as semver          from 'semver'
import * as lo              from 'lodash'

import {
  RunContextBase, 
  LOG_LEVEL,
  RUN_MODE,
  InitConfig,
  RunState,
  RCLoggerBase
}  from '@mubble/core'

import  {MasterMgr}         from './master/ma-manager'

// Import from external modules without types
const colors:any = require('colors/safe') // https://github.com/marak/colors.js/

colors.setTheme({
  DEBUG: 'grey',
  WARN:  'magenta',
  ERROR: 'red'
})

const CONS = "BCDFGHJKLMNPQRSTVWXYZ",
      VOWS = "AEIOU"

export {RUN_MODE, LOG_LEVEL} from '@mubble/core'
export class InitConfigServer extends InitConfig {

  constructor(       logLevel  ?: LOG_LEVEL, 
                     tzMin     ?: number,
              public accessLog ?: boolean) {

    super(logLevel || LOG_LEVEL.STATUS, 
          !!process.stdout.isTTY,
          tzMin)

          
    if (accessLog === undefined) this.accessLog = true      
  }
}

export class RunStateServer extends RunState {

  private runIdIndx : number[] = [lo.random(0, CONS.length - 1), 
                                  lo.random(0, VOWS.length - 1), 
                                  lo.random(0, CONS.length - 1)]


  // mark worker is going down via this variable
  private stopping: boolean = false

  getRunIdIndex() {
    return this.runIdIndx
  }

  isStopping(): boolean {
    return this.stopping
  }

  setStopping() {
    return this.stopping === true
  }
}

export abstract class RunContextServer extends RunContextBase {

  /*------------------------------------------------------------------------------
    Static declarations
  ------------------------------------------------------------------------------*/
  masterMgr   : MasterMgr

  private static initDone: boolean
  
  static init(minNodeVersion  : string): void {
    if (!semver.gte(process.version, minNodeVersion)) {
      throw(`Node version mismatch. Needed:${minNodeVersion} found:${process.version}`)
    }
    RunContextServer.initDone = true
  }

  protected constructor(public initConfig   : InitConfigServer,
                        public runState     : RunStateServer,
                        contextId          ?: string, 
                        contextName        ?: string) {
    super(initConfig, runState, contextId, contextName)
  }

  clone(newRc : RunContextServer) {
    // nothing to do, I have no member variables
    super.clone(newRc)
  }

  getRunMode() : RUN_MODE {
    return this.initConfig.runMode
  }

  executePromise(promise: Promise<any>): void {
    promise.then((ret) => {
      this.freeRunId()
      return ret
    }, (err) => {
      this.isError() && this.error(this.getName(this), 'Run context', 
          this.contextId, 'failed with error', err)
      this.freeRunId()
      throw(err)
    })
  }

  protected getContextId(): string {

    const arRunIndex : number[] = this.runState.getRunIdIndex(),
          contextId  : string   = CONS.charAt(arRunIndex[0]) + 
                                  VOWS.charAt(arRunIndex[1]) + 
                                  CONS.charAt(arRunIndex[2]++)

    if (arRunIndex[2] === CONS.length) {
      arRunIndex[2] = 0
      arRunIndex[1]++
      if (arRunIndex[1] === VOWS.length) {
        arRunIndex[1] = 0
        arRunIndex[0]++
        if (arRunIndex[0] === CONS.length) {
          arRunIndex[0] = 0
        }
      }
    }
    return contextId
  }

  setTimeout(contextName: string, fn: (...args: any[]) => any, ms: number, ...args: any[]) {
    return setTimeout(() => {
      this._runFn(contextName, fn, args)
    }, ms)
  }

  setInterval(contextName: string, fn: (...args: any[]) => any, ms: number, ...args: any[]) {
    return setInterval(() => {
      this._runFn(contextName, fn, args)
    }, ms)
  }

  on(contextName: string, eventObj: any, eventName: string, fn: (...args: any[]) => any) {
    eventObj.on(eventName, (...args: any[]) => {
      this._runFn(contextName, fn, args)
    })
  }

  _runFn(contextName: string, fn: (...args: any[]) => any,  args: any[]) {
    const rc: RunContextServer = this.copyConstruct(this.getContextId(), contextName)
    rc.executePromise(Promise.resolve().then(() => {
      fn(rc, ...args)
    }))
  }

  private freeRunId() {
    this.isStatus() && this.hasLogged() && this.status(this.getName(this), '....Done....')
  }

  public startTraceSpan(id : string) : number | undefined {
    if(!this.isTraceEnabled()) return
    return this.logger.startTraceSpan(id)
  }

  public endTraceSpan(id : string , ackNum : number | undefined) : void {
    if(!this.isTraceEnabled()) return
    this.logger.endTraceSpan(id , ackNum)
  }

  abstract isTraceEnabled() : boolean

}

export class RCServerLogger extends RCLoggerBase {
  
  constructor(public rc : RunContextServer) {
    super(rc)
  }

  public logToConsole(level: LOG_LEVEL, logStr: string): void {
    const fn: any = colors[LOG_LEVEL[level]]
    console.log(fn ? fn(logStr) : logStr)
  }

}

