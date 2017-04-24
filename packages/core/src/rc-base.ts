/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Tue Apr 11 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {format} from './util/date'

// first index is dummy
const LEVEL_CHARS : string[] = ['', '', '', '*** ', '!!! ']

export enum LOG_LEVEL {DEBUG = 1, STATUS, WARN, ERROR, NONE}
export enum RUN_MODE {DEV, PROD}

export abstract class ExternalLogger {
  abstract log(level: LOG_LEVEL, logMsg: string): void
}

export class InitConfig {

  constructor(public runMode         : RUN_MODE,
              public logLevel        : LOG_LEVEL,
              public consoleLogging  : boolean,
              public tzMin          ?: number | undefined,
              public externalLogger ?: ExternalLogger | undefined
) {

  }
}

export class RunState {
  moduleLLMap   : { [key: string]: any } = {}
}

export abstract class RunContextBase {

  public  lastLogTS     : number    = 0

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
      newRcb.lastLogTS = this.lastLogTS
    }
  }

  changeLogLevel(moduleName: string, logLevel: LOG_LEVEL) {
    this.runState.moduleLLMap[moduleName] = logLevel
  }

  getLogLevel(): LOG_LEVEL {
    return this.initConfig.logLevel
  }

  /**
   * Tries to figure out the name of the context
   * @param obj: this 
   */
  getName(obj: any): string {
    return obj.name || (obj.constructor ? obj.constructor.name : '?')
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

  debug(moduleName: string, ...args: any[]) {
    return this._log(moduleName, LOG_LEVEL.DEBUG, args)
  }

  status(moduleName: string, ...args: any[]) {
    return this._log(moduleName, LOG_LEVEL.STATUS, args)
  }

  warn(moduleName: string, ...args: any[]) {
    return this._log(moduleName, LOG_LEVEL.WARN, args)
  }

  error(moduleName: string, ...args: any[]) {
    return this._log(moduleName, LOG_LEVEL.ERROR, args)
  }

  hasLogged(): boolean {
    return this.lastLogTS !== 0
  }

  private _log(moduleName: string, level: LOG_LEVEL, args: any[]): string {

    const refLogLevel = this.runState.moduleLLMap[moduleName] || this.getLogLevel()
    if (level < refLogLevel) return 'not logging'

    const curDate = new Date(),
          dateStr = format(curDate, '%dd%/%mm% %hh%:%MM%:%ss%.%ms%', this.initConfig.tzMin),
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

    if (this.initConfig.consoleLogging) {
      const logStr = this.contextId ?
              `${LEVEL_CHARS[level]}${dateStr} ${durStr} [${this.contextId}] ${moduleName}(${this.contextName}): ${buffer}` :
              `${LEVEL_CHARS[level]}${dateStr} ${durStr} ${moduleName}: ${buffer}`
      this.logToConsole(level, logStr)
    }

    return buffer
  }

  abstract logToConsole(level: LOG_LEVEL, logMsg: string): void

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

  private objectToString(obj: Object, lvl: number): string {
    
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

    if (isSet || isMap) {
      keys = (obj as any).keys()
      keyLength = (obj as any).size
    } else {
      keys = Object.keys(obj)
      keyLength = keys.length
    }
    
    if (!isArray && ((str = obj.toString()) !== '[object Object]')) {
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
        
        if (!lvl) {
          
          if (Array.isArray(value)) {
            len = value.length
            buffer += '[' + (len ? len + 'x' : '') + ']'
          } else {
            len = Object.keys(value).length
            buffer += '{' + (len ? len + 'x' : '') + '}'
          }
          
        } else {
          buffer += this.objectToString(value, lvl - 1)
        }
      }
    }
    return isArray || isSet ? '[' + buffer + ']' : '{' + buffer + '}'
  }
}

