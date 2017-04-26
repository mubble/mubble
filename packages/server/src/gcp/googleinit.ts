/*------------------------------------------------------------------------------
   About      : Initialize datastore with the respective credentials,
                with respect to the run mode
   
   Created on : Thu Apr 20 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as path              from 'path'
import {
        RunContextServer,
        RUN_MODE,
       }                      from '../rc-server'
import {execCmd}              from '../util/execute'
import {getRunAs}             from '../util/userInfo'
import {LOG_LEVEL}            from '@mubble/core'
import {
        AUTH_KEY,
        PROJECT_ID
       }                       from './credentials'


export async function googleInit(rc : RunContextServer) {
  let instanceEnv : String  = '',
      projectEnv  : String  = '', 
      hostname    : String  = '',
      namespace   : String  = '',
      projectId   : String  = PROJECT_ID,
      doAuth      : Boolean = false

  const attrCmd   : string  = 'curl --fail metadata.google.internal/computeMetadata/v1/instance/attributes/MUBBLE_ENV -H "Metadata-Flavor: Google"'

  instanceEnv = await execCmd(attrCmd, true, true)

  if (instanceEnv) {

    const projAttrCmd : string  = 'curl --fail metadata.google.internal/computeMetadata/v1/project/attributes/projectEnv -H "Metadata-Flavor: Google"'
    const projIdCmd   : string  = 'curl --fail metadata.google.internal/computeMetadata/v1/project/project-id -H "Metadata-Flavor: Google"'
    const hostNameCmd : string  = 'curl --fail metadata.google.internal/computeMetadata/v1/instance/hostname -H "Metadata-Flavor: Google"'

    projectEnv = await execCmd(projAttrCmd, true, true)
    projectId  = await execCmd(projIdCmd, true, true)
    hostname   = await execCmd(hostNameCmd, true, true)
  }

  switch(rc.getRunMode()) {
    case RUN_MODE.PROD: {
      if (instanceEnv !== 'PROD') {
        throw(new Error('InstanceEnv Mismatch'))
      } else if (projectEnv !== 'PROD') {
        throw(new Error('ProjectEnv Mismatch'))
      }
      namespace = instanceEnv
      break
    }

    default: {
      if(projectId && hostname) {
        const instanceName : string = hostname.split('.')[0]
        namespace = instanceName
      } else {
        namespace = getRunAs().toUpperCase()
        doAuth = true
      }
    }
  }
  rc.isStatus() && rc.status(this.constructor.name, 'Datastore Initialized => Project: ', projectId, ' [Namespace: ', namespace, ']')
  return {doAuth : doAuth, projectId : projectId, authKey : AUTH_KEY, namespace : namespace }
}