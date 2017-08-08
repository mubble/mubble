/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Mon Apr 17 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import {
  RunContextBase, 
  RUN_MODE,
  LOG_LEVEL,
  InitConfig,
  RunState,
  RCLoggerBase,
  Timer,
  Mubble
}  from '@mubble/core'

import {
  GlobalKeyValue,
  UserKeyValue
} from './storage'

const CONSOLE_FN_MAP : ((message?: any, ...optionalParams: any[]) => void)[] = []

CONSOLE_FN_MAP[LOG_LEVEL.DEBUG]   = console.log
CONSOLE_FN_MAP[LOG_LEVEL.STATUS]  = console.info || console.log
CONSOLE_FN_MAP[LOG_LEVEL.WARN]    = console.warn || console.log
CONSOLE_FN_MAP[LOG_LEVEL.ERROR]   = console.error || console.log

export {LOG_LEVEL, RUN_MODE} from '@mubble/core'

export class InitConfigBrowser extends InitConfig {

  constructor(runMode         : RUN_MODE,
              logLevel        : LOG_LEVEL,
              tzMin          ?: number | undefined) {

    super(logLevel, logLevel !== LOG_LEVEL.NONE, tzMin)

    if (runMode === RUN_MODE.PROD && logLevel !== LOG_LEVEL.NONE) {
      console.log('You must turn off logging in production mode')
    }
  }



}

export class RunStateBrowser extends RunState {
}

export class RCBrowserLogger extends RCLoggerBase {
  
  constructor(public rc : RunContextBrowser) {
    super(rc)
  }

  public logToConsole(level: LOG_LEVEL, logStr: string): void {
    const fn: any = CONSOLE_FN_MAP[level]
    fn.call(console, logStr)
  }
}

export abstract class RunContextBrowser extends RunContextBase {

  public timer  : Timer
  public lang   : string
  globalKeyVal  : GlobalKeyValue
  userKeyVal    : UserKeyValue

  protected constructor(public initConfig   : InitConfigBrowser,
                        public runState     : RunStateBrowser,
                        contextId          ?: string, 
                        contextName        ?: string) {
    super(initConfig, runState, contextId, contextName)
  }

  // Called only once in the lifetime of app during app load
  init() {
    this.timer  = new Timer()
    this.lang   = Mubble.Lang.English
    this.logger = new RCBrowserLogger(this)
  }

  clone(newRc : RunContextBrowser) {
    super.clone(newRc)
    newRc.timer = this.timer
  }
}