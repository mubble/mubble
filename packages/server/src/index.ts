/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Wed Apr 12 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
export {startCluster}         from './cluster/master'
export {web}                  from './xmn/web'
export {router}               from './router/router'
export {RunContextServer, 
        RUN_MODE}             from './util/rc-server'
export {Repl}                 from './util/repl'

/* TODO:

  - Can add color support for logging. We will need to test it on linux to see it working
  - Need to develop crypto & binary protocol for ws
  - test wss for websocket communication
  - Core & Browser project is targeted at es2015. They will need to move to es5
  - Need to test app on old Alcatel phone
  - Tell rule of not coding function (must use arrow), must use class





*/