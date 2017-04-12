/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Tue Apr 11 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {SERVER_CONFIG, CLIENT_CONFIG, LOG_LEVEL} from './config'

export interface SystemConfig {
  LOG_LEVEL   : LOG_LEVEL,
  CONSOLE_LOG : boolean,
  LOG_TZ_MIN  : number | undefined,
  ACCESS_LOG  : boolean
}

export let systemConfig: SystemConfig

declare var process: any;

export function serverInit(config: SERVER_CONFIG) {
  
  systemConfig = {
    LOG_LEVEL     : LOG_LEVEL.NONE,
    CONSOLE_LOG   : false,
    LOG_TZ_MIN    : config.LOG_TZ_MIN,
    ACCESS_LOG    : true
  }

  if (config.LOG_LEVEL === LOG_LEVEL.NONE) {
    throw('Log level none is not permitted on server')
  }

  systemConfig.LOG_LEVEL = config.LOG_LEVEL === undefined ? LOG_LEVEL.STATUS : config.LOG_LEVEL
  if (process) {
    if (config.CONSOLE_LOG === undefined && process.stdout.isTTY) systemConfig.CONSOLE_LOG = true
  }
  if (config.ACCESS_LOG === false) systemConfig.ACCESS_LOG = false
}