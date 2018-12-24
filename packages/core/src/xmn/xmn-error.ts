/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Tue Jun 27 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

export const XmnError = {

  errorCode           : 555,

  NetworkNotPresent   : 'NetworkNotPresent',  // Network is absent
  ConnectionFailed    : 'ConnectionFailed',   // server connect problem: server not running, no network, connection break
  RequestTimedOut     : 'RequestTimedOut',    // ideally means api bug
  SendTimedOut        : 'SendTimedOut',       // ideally means terribly slow connection
  UnAuthorized        : 'UnAuthorized',       // When the client id is not valid (server to server)

  _NotReady           : '_NotReady'           // Used by the client when connection is not ready
}
