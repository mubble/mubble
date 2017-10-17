/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Tue Jun 27 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

export const XmnError = {

  ConnectionFailed    : 'ConnectionFailed',   // server connect problem: server not running, no network, connection break
  RequestTimedOut     : 'RequestTimedOut',    // ideally means api bug
  SendTimedOut        : 'SendTimedOut',       // ideally means terribly slow connection
  UnsupportedVersion  : 'UnsupportedVersion', // client app version is not supported by the server, update from playstore

  _NotReady         : '_NotReady'
}
