/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Mon Apr 17 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import {LoggerBase, LOG_LEVEL}  from '@mubble/core'

const CONSOLE_FN_MAP : ((message?: any, ...optionalParams: any[]) => void)[] = []

CONSOLE_FN_MAP[LOG_LEVEL.DEBUG]   = console.log
CONSOLE_FN_MAP[LOG_LEVEL.STATUS]  = console.info || console.log
CONSOLE_FN_MAP[LOG_LEVEL.WARN]    = console.warn || console.log
CONSOLE_FN_MAP[LOG_LEVEL.ERROR]   = console.error || console.log

export {LOG_LEVEL} from '@mubble/core'
export class Logger extends LoggerBase {

  static init(isRelease: boolean, inLogLevel ?: LOG_LEVEL) {

    const logLevel : LOG_LEVEL = isRelease ? LOG_LEVEL.NONE : 
                        (inLogLevel !== undefined ? inLogLevel : LOG_LEVEL.STATUS)

    LoggerBase.initBase(logLevel, logLevel !== LOG_LEVEL.NONE, true)
  }

  static getLogger(moduleName: string, logLevel ?: LOG_LEVEL) {
    const logger = new Logger(logLevel)
    logger.setModuleName(moduleName)
    return logger
  }

  constructor(logLevel ?: LOG_LEVEL) {
    super(logLevel)
  }

  logToConsole(level: LOG_LEVEL, logStr: string): void {

    const fn: any = CONSOLE_FN_MAP[level]
    fn(logStr)
  }
}