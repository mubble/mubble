/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Tue Apr 11 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import { omit, keysIn}              from 'lodash'  

import  {format}                    from './util/date'
import {
  ConnectionInfo, 
  WireEventResp,
  WireReqResp,
  WireObject
} from './xmn'

import { Timer } from './util/timer'

// first index is dummy
const LEVEL_CHARS : string[] = ['', '', '', '*** ', '!!! ']

export enum LOG_LEVEL {DEBUG = 1, STATUS, WARN, ERROR, NONE }
export enum RUN_MODE { DEV, QA, PRE_PROD, PROD, LOAD }

export abstract class ExternalLogger {
  
  abstract log(level: LOG_LEVEL, logMsg: string): void
  
  abstract sessionLog(sessionLogBuf : string , sessionFileName : string) : void 

  abstract accessLog(logBuf : string) : void ;

}

export class InitConfig {
  
  public runMode         : RUN_MODE
  constructor(public logLevel        : LOG_LEVEL,
              public consoleLogging  : boolean,
              public tzMin          ?: number,
              public externalLogger ?: ExternalLogger 
) {
    this.runMode = RUN_MODE.DEV
  }
}

export class RunState {
  moduleLLMap   : { [key: string]: any } = {}
  modLogLevel   : LOG_LEVEL = LOG_LEVEL.NONE
  moduleNameMap : WeakMap<any, string>   = new WeakMap()
}

export abstract class RunContextBase {

  public  logger  : RCLoggerBase
  public timer    : Timer
  
  protected constructor(public initConfig   : InitConfig,
              public runState     : RunState,
              public contextId   ?: string, 
              public contextName ?: string) {
  }

  // Called only once in the lifetime of execution during initialization
  init(): void {
    this.timer  = new Timer()
  }

  abstract copyConstruct(contextId ?: string, contextName ?: string): any

  clone(newRcb: RunContextBase) {

    newRcb.initConfig   = this.initConfig
    newRcb.runState     = this.runState
    newRcb.timer        = this.timer
    
    /*
    if (newRcb.contextId === this.contextId && newRcb.contextName === this.contextName) {
      newRcb.logger.lastLogTS = this.logger.lastLogTS
      newRcb.startTs   = this.startTs
    }*/
  }

  public finish(ic : ConnectionInfo,  resp: WireEventResp | WireReqResp  , req : WireObject , apiName ?: string) : void {
      this.logger.finish(ic, resp , req , apiName)
  }
  
  public setupLogger(obj: any, moduleName: string, logLevel ?: LOG_LEVEL) {

    this.runState.moduleNameMap.set(obj, moduleName)

    if (this.initConfig.logLevel !== LOG_LEVEL.NONE && logLevel !== undefined) {
      this.runState.moduleLLMap[moduleName] = logLevel
      const keys = Object.keys(this.runState.moduleLLMap)
      this.runState.modLogLevel = LOG_LEVEL.NONE
      for (const key of keys) {
        if (this.runState.moduleLLMap[key] < this.runState.modLogLevel) {
          this.runState.modLogLevel = this.runState.moduleLLMap[key]
        }
      }
    }
  }

  public getGlobalLogLevel(): LOG_LEVEL {
    return this.initConfig.logLevel
  }

  public setGlobalLogLevel(logLevel: LOG_LEVEL) {
    this.initConfig.logLevel = logLevel
  }

  getLogLevel(): LOG_LEVEL {
    return this.initConfig.logLevel > this.runState.modLogLevel ? 
           this.runState.modLogLevel : this.initConfig.logLevel
  }

  /**
   * Tries to figure out the name of the context
   * @param obj: this 
   */
  getName(obj: any): string {
    return obj ? (this.runState.moduleNameMap.get(obj) || obj.name || 
                 (obj.constructor ? obj.constructor.name : '?')) : '?'
  }

  isDebug(): boolean {
    return this.getLogLevel() <= LOG_LEVEL.DEBUG
  }

  isStatus(): boolean {
    return this.getLogLevel() <= LOG_LEVEL.STATUS
  }

  isWarn(): boolean {
    return this.getLogLevel() <= LOG_LEVEL.WARN
  }

  isError(): boolean {
    return this.getLogLevel() <= LOG_LEVEL.ERROR
  }

  isAssert(): boolean {
    return this.initConfig.runMode !== RUN_MODE.PROD
  }

  debug(moduleName: string, ...args: any[]) {
    return this.logger.log(moduleName, LOG_LEVEL.DEBUG, args)
  }

  status(moduleName: string, ...args: any[]) {
    return this.logger.log(moduleName, LOG_LEVEL.STATUS , args)
  }

  warn(moduleName: string, ...args: any[]) {
    return this.logger.log(moduleName, LOG_LEVEL.WARN , args)
  }

  error(moduleName: string, ...args: any[]) {
    return this.logger.log(moduleName, LOG_LEVEL.ERROR, args)
  }

  assert(moduleName: string, condition: any, ...args: any[]) {
    if (!condition) {
      args.unshift('Assertion failed!')
      throw(new Error(this.logger.log(moduleName, LOG_LEVEL.ERROR, args)))
    }
  }

  hasLogged(): boolean {
    return this.logger.lastLogTS !== 0
  }
   
}

export type LogCacheEntry = {
  ts : number ,
  moduleName : string , 
  level : LOG_LEVEL ,
  log : string 
}

// Replacer Function to take Care of cyclic object references
export function safeReplacerFn(){
  
  const seen : any [] = []
  return function(key : string, value : any) : any {
    if (value != null && typeof value == "object") {
      if (seen.indexOf(value) >= 0) {
        return
      }
      seen.push(value);
    }
    return value
  }
}

export abstract class RCLoggerBase {

  public  sesLogCache       : LogCacheEntry[]  = []
  public  lastLogTS         : number = 0
  public  sessionContext    : boolean = false
  public  startTs           : number = Date.now()
  // Trace related
  private   k                 : number = 0    
  public traceSpans : {[traceId : string] :  {startTime : number , endTime : number} } = {}
  public finishedTraceSpans : {id : string , startTime : number , endTime : number} [] = []
  public ignoreTrace : boolean = false
  
  protected constructor(public rc : RunContextBase) {
    
  }

  public finish(ic : ConnectionInfo, er: WireEventResp | WireReqResp , req : WireObject , apiName ?: string) : void {
    // default Implementation .
  }

  public startTraceSpan(id : string) : number | undefined {
    if(!this.traceSpans[id]) {
      this.traceSpans[id] = {startTime : Date.now(), endTime : 0}
    } else {
      // already unfinished span exists
      this.k += 1
      const mId = id + '-' + this.k
      // create new span with id + count
      this.traceSpans[mId] = {startTime : Date.now() , endTime : 0}
      return this.k // return duplicate count
    }
    return 
  }

  public endTraceSpan(id : string , ackNumber : number | undefined ) : void {
    if(this.ignoreTrace) {
      this.rc.isWarn() && this.rc.warn(this.rc.getName(this), 'IgnoreTrace set. Ignoring trace ',id , ackNumber)
      return
    }

    const mId       = ackNumber ? id + '-'+ ackNumber : id ,
          startTime = this.traceSpans[mId] ? this.traceSpans[mId].startTime : 0

    if(startTime) {
      this.finishedTraceSpans.push({id : id , startTime : startTime , endTime : Date.now()})
      delete this.traceSpans[mId]
    } else {
      this.rc.isError() && this.rc.error(this.rc.getName(this), new Error('Start span not called'))
      throw new Error('Start span not called, Id: ' + id + ' '+ackNumber)
    }
  }

  public getWorkerIdentifier() : string | null {
    return null
  }

  abstract logToConsole(level: LOG_LEVEL, logMsg: string): void

  public log(moduleName: string, level: LOG_LEVEL, args: any[]): string {

    const refLogLevel = this.rc.runState.moduleLLMap[moduleName] || this.rc.initConfig.logLevel

    if (level < refLogLevel) return 'not logging'
    if (!this.rc.initConfig.consoleLogging && !this.rc.initConfig.externalLogger) return 'not logging'

    const curDate = new Date(),
          dateStr = format(curDate, '%dd%/%mm% %hh%:%MM%:%ss%.%ms%', this.rc.initConfig.tzMin),
          durStr  = this.durationStr(curDate.getTime())

    let buffer : string = args.reduce((buf, val) => {
      let strVal
      if (val instanceof Error) {
        // Error.name typically has class name of the ErrorCLass like EvalError
        // Error.message has the user readable message, this is also included in the stack
        strVal = val.stack || `Error ${val.name}: ${val.message} (no stack)`
        let errObj = omit(val , ['message'])
        if(keysIn(errObj).length){
          strVal = this.objectToString(errObj , 5) + ' '+ strVal
        }
        if(val.message && strVal.indexOf(val.message)==-1){
          // case when stack does not contain the message
          strVal = val.message + ' '+ strVal
        }
      } else if (val && (typeof(val) === 'object')) {
        strVal = this.objectToString(val, 2)
      } else {
        strVal = String(val).trim()
      }
      return buf ? buf + ' ' + strVal : strVal
    }, '')
    
    if (!this.rc.initConfig.consoleLogging && buffer.length > 500) buffer = buffer.substr(0, 500)

    let workerIdentifer = this.getWorkerIdentifier() || '' ,
        logStr = this.rc.contextId ?
              `${LEVEL_CHARS[level]}${dateStr} ${durStr} [${this.rc.contextId}][${workerIdentifer}] ${moduleName}(${this.rc.contextName}): ${buffer}` :
              `${LEVEL_CHARS[level]}${dateStr} ${durStr} [${workerIdentifer}] ${moduleName}: ${buffer}`

    if (this.rc.initConfig.consoleLogging) {
      this.logToConsole(level, logStr)
    }
    if(this.rc.initConfig.externalLogger)
    {
      if(this.sessionContext){
        this.sesLogCache.push({
                ts : Date.now() , 
                moduleName : moduleName , 
                level : level , 
                log : buffer  })
      }else{
        this.rc.initConfig.externalLogger.log(level , logStr)
      }
    }

    return buffer
  }

  private durationStr(ts: number): string {

    const ms = ts - this.lastLogTS

    if (!this.lastLogTS) {
      this.lastLogTS = ts
      return '---'
    }

    this.lastLogTS = ts
    
    if (ms < 10)  return '  ' + ms
    if (ms < 100) return  ' ' + ms
    if (ms < 1000) return ms.toString()
    if (ms < 10000) return (ms / 1000).toFixed(1)
    return '+++'
  }

  protected objectToString(obj: Object, maxLevels: number, pendingLevels ?:number): string {
    
    const isArray = Array.isArray(obj),
          isSet   = obj instanceof Set,
          isMap   = obj instanceof Map,
          MAX_KEYS = 20

    let buffer    : string  = '', 
        str       : string, 
        value, 
        len       : number, 
        valType, 
        keys      : string[], 
        keyLength : number

    if (pendingLevels === undefined) pendingLevels = maxLevels    
    if (isSet || isMap) {
      keys = (obj as any).keys()
      keyLength = (obj as any).size
    } else {
      keys = Object.keys(obj)
      keyLength = keys.length
    }
    
    if (typeof(obj) === 'function') {
      const fn = obj as Function
      return maxLevels === pendingLevels ? fn.toString() : 'function ' + fn.name
    }
    //console.log(`obj: ${obj} ,${typeof(obj)}, ${obj.toString()} , ${typeof(obj.toString())}`)
    if (!isArray && typeof(obj.toString) === 'function') {
      const str = obj.toString()
      if(typeof(str) === 'number' || (typeof(str)==='string' && !str.startsWith('[object'))) return str
    }
    
    for (const key of keys) {
      
      if (buffer) buffer += ', '
      if (key === String(MAX_KEYS) && keyLength - MAX_KEYS > 1) {
        buffer += (keyLength - MAX_KEYS) + ' more...'
        break
      }
      
      if (!isArray && !isSet) buffer += key + ':'
      
      value   = isSet ? key : (isMap ? (obj as Map<any, any>).get(key) : (obj as any)[key])
      valType = typeof(value)
      
      if (valType === 'function') {
          
        str = value.name
        buffer += str ? str + '()' : value.toString().substr(0, 50)
        
      } else if ((!value) || (valType !== 'object')) {
        
        try{
          str = String(JSON.stringify(value))
        }catch(error){
          // Take care of circular Objects
          str = String(JSON.stringify(value , safeReplacerFn()))
        }
        buffer += str.length > 50 ? str.substr(0, 50) + '..' : str
        
      } else {
        
        if (!pendingLevels) {
          
          if (Array.isArray(value)) {
            len = value.length
            buffer += '[' + (len ? len + 'x' : '') + ']'
          } else {
            len = Object.keys(value).length
            buffer += '{' + (len ? len + 'x' : '') + '}'
          }
          
        } else {
          buffer += this.objectToString(value, maxLevels, pendingLevels - 1)
        }
      }
    }
    return isArray || isSet ? '[' + buffer + ']' : '{' + buffer + '}'
  }
  
}


