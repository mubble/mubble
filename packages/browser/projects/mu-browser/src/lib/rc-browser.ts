/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Mon Apr 17 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import { RunContextBase, 
         RUN_MODE,
         LOG_LEVEL,
         InitConfig,
         RunState,
         RCLoggerBase
       }                          from '@mubble/core'

import { GlobalKeyValue,
         UserKeyValue,
         ConfigKeyVal
       }                          from './storage'
import { AudioPlayer }            from './util'
import { MuUtility }              from './util/utility'
import { MuRouterApp }            from './framework/router-app'
import { MuBridge }               from './framework'
import { AnalyticsEventLogger }   from './framework/analytics'
import { MuUiRouter }             from './framework/ui-router'

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

    if ((runMode === RUN_MODE.PROD || runMode === RUN_MODE.PRE_PROD) && logLevel !== LOG_LEVEL.NONE) {
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

  public lang     : string
  globalKeyVal    : GlobalKeyValue
  userKeyVal      : UserKeyValue

  router          : MuRouterApp
  bridge          : MuBridge
  gcConfigKeyVal  : ConfigKeyVal
  userEvent       : AnalyticsEventLogger
  uiRouter        : MuUiRouter
  audio           : AudioPlayer
  utils           : MuUtility

  // Stores the old error handler
  // private oldOnError    : any

  protected constructor(public initConfig   : InitConfigBrowser,
                        public runState     : RunStateBrowser,
                        contextId          ?: string, 
                        contextName        ?: string) {
    super(initConfig, runState, contextId, contextName)
  }

  preInit() {
    super.init()
    this.logger   = new RCBrowserLogger(this)
  }




  // Called only once in the lifetime of app during app load
  // init() {
  //   super.init()
  //   this.lang       = Mubble.Lang.English
  //   this.logger     = new RCBrowserLogger(this)

  //   const storage       = new StorageProvider()
  //   this.globalKeyVal   = new GlobalKeyValue(this, storage)
  //   this.userKeyVal     = new UserKeyValue(this, storage)
  //   this.gcConfigKeyVal = new ConfigKeyVal(this, storage)
  //   this.audio          = new AudioPlayer(this)
  //   this.utils          = new Utility()
  //   // this.oldOnError = window.onerror
  //   // window.onerror  = this.onError.bind(this)
  // }

  // clone(newRc : RunContextBrowser) {
  //   super.clone(newRc)
  // }

  // This is not getting called as errors are caught by Angular or by core.js
  // onError(msg: string, src: string, line: number, col: number, obj) {

  //   try {
  //     const errorObj = { msg, 
  //       source   : src + '[' + line + ':' + col + ']',
  //       stack    : obj ? obj.stack : ''
  //     }
  //     this.isError() && this.error(this.getName(this), 'unhandled exception', errorObj)
  //     if (this.oldOnError) this.oldOnError.apply(null, arguments)
  //   } catch (e) {}

  //   return false
  // }
}