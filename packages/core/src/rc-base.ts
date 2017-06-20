/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Tue Apr 11 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import 
 { InConnectionBase ,
   InEventBase , 
   InRequestBase}                 from './xmn/xmn-router'

import      {format}              from './util/date'

// first index is dummy
const LEVEL_CHARS : string[] = ['', '', '', '*** ', '!!! ']

export enum LOG_LEVEL {DEBUG = 1, STATUS, WARN, ERROR, NONE}
export enum RUN_MODE {DEV, PROD}

export abstract class ExternalLogger {
  
  abstract log(level: LOG_LEVEL, logMsg: string): void
  
  abstract sessionLog(sessionLogBuf : string , sessionFileName : string) : void 

  abstract accessLog(logBuf : string) : void ;

  //abstract getSessionLogger(rc : RunContextBase) : RCLoggerBase ;
}

export class InitConfig {

  constructor(public runMode         : RUN_MODE,
              public logLevel        : LOG_LEVEL,
              public consoleLogging  : boolean,
              public tzMin          ?: number,
              public externalLogger ?: ExternalLogger 
) {

  }
}

export class RunState {
  moduleLLMap   : { [key: string]: any } = {}
  modLogLevel   : LOG_LEVEL = LOG_LEVEL.NONE
}

export abstract class RunContextBase {

  public  userContext   : string   
  
  public  logger        : RCLoggerBase
  
  protected constructor(public initConfig   : InitConfig,
              public runState     : RunState,
              public contextId   ?: string, 
              public contextName ?: string) {
  }

  abstract copyConstruct(contextId ?: string, contextName ?: string): any

  clone(newRcb: RunContextBase) {
    newRcb.initConfig   = this.initConfig
    newRcb.runState     = this.runState
    if (newRcb.contextId === this.contextId && newRcb.contextName === this.contextName) {
      newRcb.logger.lastLogTS = this.logger.lastLogTS
    }
  }

  public finish(resData : any , ic : InConnectionBase, ire: InRequestBase | InEventBase) : Promise<any> {
    return new Promise((resolve : any , reject : any)=> {
      this.logger.finish(ic, ire)
      resolve(resData)
    })
  }
  
  public setUserContext(uContext : string) {
    this.userContext = uContext
  }

  changeLogLevel(moduleName: string, logLevel: LOG_LEVEL) {
    console.log('this.runState.modLogLevel', this.runState.modLogLevel)
    this.runState.moduleLLMap[moduleName] = logLevel
    const keys = Object.keys(this.runState.moduleLLMap)
    this.runState.modLogLevel = LOG_LEVEL.NONE
    for (const key of keys) {
      if (this.runState.moduleLLMap[key] < this.runState.modLogLevel) {
        this.runState.modLogLevel = this.runState.moduleLLMap[key]
      }
    }
    console.log('this.runState.modLogLevel', this.runState.modLogLevel)
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
    return obj ? (obj.name || (obj.constructor ? obj.constructor.name : '?')) : '?'
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
    return this.initConfig.runMode != RUN_MODE.PROD
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

  assert(moduleName: string, condition: boolean, ...args: any[]) {
    if (!condition) {
      throw(new Error(this.logger.log(moduleName, LOG_LEVEL.ERROR, args)))
    }
  }

  hasLogged(): boolean {
    return this.logger.lastLogTS !== 0
  }

}

export abstract class RCLoggerBase {

  private sesLogCache   : string[]  = []
  public  lastLogTS     : number    = 0

  protected constructor(public rc : RunContextBase) {

  } 

  
  public  finish(ic : InConnectionBase, ire: InRequestBase | InEventBase) : void {

  }

  abstract logToConsole(level: LOG_LEVEL, logMsg: string): void

  public log(moduleName: string, level: LOG_LEVEL, args: any[]): string {

    const refLogLevel = this.rc.runState.moduleLLMap[moduleName] || this.rc.initConfig.logLevel

    if (level < refLogLevel) return 'not logging'

    const curDate = new Date(),
          dateStr = format(curDate, '%dd%/%mm% %hh%:%MM%:%ss%.%ms%', this.rc.initConfig.tzMin),
          durStr  = this.durationStr(curDate.getTime())

    let buffer = args.reduce((buf, val) => {
      let strVal
      if (val instanceof Error) {
        // Error.name typically has class name of the ErrorCLass like EvalError
        // Error.message has the user readable message, this is also included in the stack
        strVal = val.stack || `Error ${val.name}: ${val.message} (no stack)`
      } else if (val && (typeof(val) === 'object')) {
        strVal = this.objectToString(val, 2)
      } else {
        strVal = String(val).trim()
      }
      return buf ? buf + ' ' + strVal : strVal
    }, '')

    if (this.rc.initConfig.consoleLogging) {
      const logStr = this.rc.contextId ?
              `${LEVEL_CHARS[level]}${dateStr} ${durStr} [${this.rc.contextId}] ${moduleName}(${this.rc.contextName}): ${buffer}` :
              `${LEVEL_CHARS[level]}${dateStr} ${durStr} ${moduleName}: ${buffer}`
      this.logToConsole(level, logStr)
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

  private objectToString(obj: Object, maxLevels: number, pendingLevels ?:number): string {
    
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

    if (!isArray && typeof(obj.toString) === 'function' && (!(str = obj.toString()).startsWith('[object'))) {
      //console._log('toString did not match', obj.toString, ({}).toString)
      return str
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
        
        str = String(JSON.stringify(value))
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


