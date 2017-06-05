/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Wed Apr 12 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
export {
        startCluster,
        isClusterMaster
      }                       from './cluster/master'
export {web}                  from './xmn/web'
export *                      from './rc-server'
export {Repl}                 from './util/repl'
export *                      from './util/user-info'
export *                      from './util/execute'
export *                      from './util/https-request'
export *                      from './gcp/gcloud-env'
export *                      from './db/datastore/basedatastore'
export *                      from './db/datastore/ds-query'
export *                      from './db/cloudstorage/cloudstorage-base'

/* TODO:

  - Can add color support for logging. We will need to test it on linux to see it working
  - Need to develop crypto & binary protocol for ws
  - test wss for websocket communication
  - Core & Browser project is targeted at es2015. They will need to move to es5
  - Need to test app on old Alcatel phone
  - Tell rule of not coding function (must use arrow), must use class





*/