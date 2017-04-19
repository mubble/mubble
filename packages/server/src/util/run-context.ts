/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Thu Apr 13 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as semver          from 'semver'
import * as lo              from 'lodash'

import {LoggerBase, LOG_LEVEL, LoggerContext}  from '@mubble/core'

// Import from external modules without types
const colors:any = require('colors/safe') // https://github.com/marak/colors.js/

colors.setTheme({
  DEBUG: 'grey',
  WARN: 'magenta',
  ERROR: 'red'
})

export enum RUN_MODE {DEV, PROD}

const CONS = "BCDFGHJKLMNPQRSTVWXYZ",
      VOWS = "AEIOU"

interface RunEnv {
  
  accessLog    : boolean /** (optional) default true */
  runMode   : RUN_MODE
  runIdIndx : number[]
}


export class RunContext extends LoggerBase {

  /*------------------------------------------------------------------------------
    Static declarations
  ------------------------------------------------------------------------------*/

  private static runEnv   : RunEnv
  private static adHocRc  : RunContext

  static init(runMode         : RUN_MODE,
              minNodeVersion  : string, 
              logTzMin       ?: number,
              inLogLevel     ?: LOG_LEVEL, 
              inAccessLog    ?: boolean,
              inConsoleLog   ?: boolean): RunContext {

    if (RunContext.runEnv) {
      throw('Run context must be initialized only once')
    }

    if (!semver.gte(process.version, minNodeVersion)) {
      throw(`Node version mismatch. Needed:${minNodeVersion} found:${process.version}`)
    }
    
    if (inLogLevel === LOG_LEVEL.NONE) {
      throw('Log level none is not permitted on server')
    }

    const logLevel  : LOG_LEVEL = inLogLevel   === undefined ? LOG_LEVEL.STATUS     : inLogLevel
    const accessLog : boolean   = inAccessLog  === undefined ? true                 : inAccessLog
    const consoleLog: boolean   = inConsoleLog === undefined ? process.stdout.isTTY || false : inConsoleLog

    RunContext.runEnv = {
      accessLog     : accessLog, 
      runMode       : runMode,
      runIdIndx     : [lo.random(0, CONS.length - 1), lo.random(0, VOWS.length - 1), lo.random(0, CONS.length - 1)]
    }

    LoggerBase.initBase(logLevel, consoleLog, false, logTzMin)

    const adRc = RunContext.adHocRc = RunContext.getNew('AdHoc', logLevel)

    return RunContext.getNew('INIT', logLevel)
  }

  static getNew(shortContextName: string, logLevel ?: LOG_LEVEL) {

    if (!RunContext.runEnv) throw('Run context should be initialized first')

    const runId = RunContext.getRunId()

    return new RunContext(runId, logLevel, {
            name  : shortContextName,
            id    : runId,
            map   : {}
           })
    
  }

  static getAdHoc(): RunContext {
    if (!RunContext.runEnv) throw('Run context should be initialized first')
    return RunContext.adHocRc
  }

  private static getRunId(): string {

    const arRunIndex : number[] = RunContext.runEnv.runIdIndx,

          runId      : string   = CONS.charAt(arRunIndex[0]) + 
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

    return runId
  }

  static setTimeout(contextName: string, fn: (...args: any[]) => any, ms: number, ...args: any[]) {
    if (!RunContext.runEnv) throw('Run context should be initialized first')
    setTimeout(() => {
      RunContext._runFn(contextName, fn, args)
    }, ms)
  }

  static on(contextName: string, eventObj: any, eventName: string, fn: (...args: any[]) => any) {
    if (!RunContext.runEnv) throw('Run context should be initialized first')
    eventObj.on(eventName, (...args: any[]) => {
      RunContext._runFn(contextName, fn, args)
    })
  }

  static _runFn(contextName: string, fn: (...args: any[]) => any,  args: any[]) {
    if (!RunContext.runEnv) throw('Run context should be initialized first')
    const rc = RunContext.getNew(contextName)
    rc.executePromise(Promise.resolve().then(() => {
      fn(rc, ...args)
    }))
  }

  /*------------------------------------------------------------------------------
    Instance level
  ------------------------------------------------------------------------------*/
  private constructor(private runId: string, logLevel ?: LOG_LEVEL, loggerContext ?: LoggerContext) {
    super(logLevel, loggerContext)
  }

  getRunMode() : RUN_MODE {
    return RunContext.runEnv.runMode
  }

  executePromise(promise: Promise<any>): void {
    promise.then((ret) => {
      this.freeRunId()
      return ret
    }, (err) => {
      this.isError() && this.error(this.constructor.name, 'Run context', 
          this.runId, 'failed with error', err)
      this.freeRunId()
      throw(err)
    })
  }

  private freeRunId() {
    this.isStatus() && this.hasLogged() && this.status(this.constructor.name, '....done....')
  }

  logToConsole(level: LOG_LEVEL, logStr: string): void {

    const fn: any = colors[LOG_LEVEL[level]]
    console.log(fn ? fn(logStr) : logStr)
  }
}