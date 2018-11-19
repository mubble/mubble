/*------------------------------------------------------------------------------
   About      : Index File to export Services as @mubble/server
   
   Created on : Wed Apr 12 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
export {
        startCluster,
        isClusterMaster,
        getWorkerIndex,
        getWorkerRestartCount
       }                      from './cluster/master'
export *                      from './xmn'
export *                      from './rc-server'
export {Repl, ReplProvider}   from './util/repl'
export *                      from './util'
// export *                      from './db'
export *                      from './cache/redis-wrapper'
export *                      from './logger/server-ext-logger'
export *                      from './master'

/* TODO:

  - Can add color support for logging. We will need to test it on linux to see it working
  - test wss for websocket communication
  - Core & Browser project is targeted at es2015. They will need to move to es5
  - Need to test app on old Alcatel phone
  - Tell rule of not coding function (must use arrow), must use class

*/
