/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Tue Apr 11 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

export enum LOG_LEVEL {NONE, DEBUG, STATUS, WARN, ERROR}

/** 
 
 - Server logging is always in context of invocation context. If there is no context, 
   context is treated as global (which is not desirable)
 - It is possible to have log level NONE when no logging takes place. It is possible 
   to set this value only in case of client logging.
 - Logging to console is controlled by process.stdout.isTTY on server. It can also be 
   turned off by setting explicit 'false' value on server. Client control via LOG_LEVEL
 - Session logging is automatically turned on based on LOG_LEVEL DEBUG / STATUS  
 - Api are 
   Logger.debug   : When you are debugging a component
   Logger.status  : When you want to give status of progress
   Logger.warn    : When you see something unexpected, most likely error, but you have remedy
   Logger.error   : When an error is encountered

*/

export interface CLIENT_CONFIG {

  /** LOG_LEVEL as defined by enum LOG_LEVEL. 
    Default: 
      client: Release build:NONE debug build: STATUS
      server: Default STATUS. NONE is not allowed
  */  
  LOG_LEVEL    ?:  LOG_LEVEL

  /** (optional) logging by platform will use this timezone 
    default: -330 for India */
  LOG_TZ_MIN   ?: number
}

export interface SERVER_CONFIG extends CLIENT_CONFIG {

  /** (optional) default true */
  ACCESS_LOG   ?: boolean

  /** (optional) default is AUTO (don't specify) that means system detect */
  CONSOLE_LOG  ?: boolean
}

