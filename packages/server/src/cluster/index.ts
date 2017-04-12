/*------------------------------------------------------------------------------
   About      : The main export from the platform. It provides access to all 
                components of the platform for ease of import
   
   Created on : Thu Apr 06 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import * as semver      from 'semver'
import * as cluster     from 'cluster'

import {clusterMaster}  from './master'
import {clusterWorker}  from './worker'
import {CONFIG}         from './config'

/**
 * This is the first API called. It start the platform with given configuration
 * @param minNodeVersion    Verify the node version before running
 * @param config            Configuration for the platform             
 */

export async function start(minNodeVersion  : string, 
                            config          : CONFIG) : Promise<any> {

  if (!semver.gte(process.version, minNodeVersion)) {
    throw(`Node version mismatch. Needed:${minNodeVersion} found:${process.version}`)
  }
  
  if (cluster.isMaster) {
    await clusterMaster.start(config)
  } else {
    await clusterWorker.start(config)
    console.log('worker started successfully with index', clusterWorker.workerIndex)
  }
}