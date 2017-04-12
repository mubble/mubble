/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Tue Apr 11 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {LOG_LEVEL}    from './config'
import {systemConfig} from './index'
import {format}       from '../util/date'


export class Logger {

  private lastLogTS: number = 0

  static getLogger(moduleName: string, logLevel ?: LOG_LEVEL) {
    
    if (!systemConfig) throw('Logger is not initialized')
    if (!logLevel)    logLevel    = systemConfig.LOG_LEVEL
    if (!moduleName)  moduleName  = '?'

    return new Logger(moduleName, logLevel as LOG_LEVEL)
  }

  constructor(private moduleName: string, private logLevel: LOG_LEVEL) {

  }

  private debug(...args: any[]) {
    return this._log(LOG_LEVEL.DEBUG, args)
  }

  private status(...args: any[]) {
    return this._log(LOG_LEVEL.STATUS, args)
  }

  private warn(...args: any[]) {
    return this._log(LOG_LEVEL.WARN, args)
  }

  private error(...args: any[]) {
    return this._log(LOG_LEVEL.ERROR, args)
  }

  private _log(level: LOG_LEVEL, ...args: any[]) {

    if (level < this.logLevel) return

    const curDate = new Date(),
          dateStr = format(curDate, '%dd%/%mm% %hh%:%MM%:%ss%.%ms%', systemConfig.LOG_TZ_MIN),
          durStr  = this.durationStr(curDate.getTime())

    let buffer = args.reduce((buf, val) => {
      let strVal
      if (val instanceof Error) {
        strVal = val.stack
      } else if (val && (typeof(val) === 'object')) {
        strVal = this.objectToString(val, 2)
      } else {
        strVal = String(val).trim()
      }
      return buf + ' ' + strVal
    }, '')
  }

  durationStr(ts: number): string {

    const ms = ts - this.lastLogTS
    this.lastLogTS = ts
    
    if (ms < 10)  return '  ' + ms
    if (ms < 100) return  ' ' + ms
    if (ms < 1000) return ms.toString()
    if (ms < 10000) return (ms / 1000).toFixed(1)
    return '+++'
  }

  objectToString(obj: Object, lvl: number): string {
    
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
      //console.log('toString did not match', obj.toString, ({}).toString)
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

