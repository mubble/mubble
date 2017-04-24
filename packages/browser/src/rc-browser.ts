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
  RunState
}  from '@mubble/core'

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

    super(runMode, logLevel, logLevel !== LOG_LEVEL.NONE, tzMin)

    if (runMode === RUN_MODE.PROD && logLevel !== LOG_LEVEL.NONE) {
      console.log('You must turn off logging in production mode')
    }
  }



}

export class RunStateBrowser extends RunState {
}

export abstract class RunContextBrowser extends RunContextBase {

  protected constructor(public initConfig   : InitConfigBrowser,
                        public runState     : RunStateBrowser,
                        contextId          ?: string, 
                        contextName        ?: string) {
    super(initConfig, runState, contextId, contextName)
  }

  clone(newRc : RunContextBrowser) {
    // nothing to do, I have no member variables
    super.clone(newRc)
  }

  logToConsole(level: LOG_LEVEL, logStr: string): void {

    const fn: any = CONSOLE_FN_MAP[level]
    fn(logStr)
  }
}