/*------------------------------------------------------------------------------
   About      : Represents a connection for client & server
   
   Created on : Sun Jun 25 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {RunContextBase}     from '../rc-base'
import {ClientIdentity}     from './client-identity'
import {Protocol}           from '@mubble/core'

export interface ConnectionInfo {

  // Connection attributes
  protocol        : Protocol
  host            : string    // host name of the server
  port            : number    // port of the server
  url             : string    // /api/getTopics Or connectUrl (for WS)
  headers         : object    // empty for client
  ip              : string    // ip address or host name of the client socket

  // Information passed by the client: to be used by Xmn internally
  publicRequest   : boolean
  msOffset        : number    // this is inferred by the server based on client's now field. Api/event need not use this

  // Information passed by the client used by   
  location        : any
  networkType     : any
  clientIdentity  : ClientIdentity

  // provider for this connection (WebSocket, Http etc.)
  provider        : any       // The protocol provider keeps it's custom data here
}
