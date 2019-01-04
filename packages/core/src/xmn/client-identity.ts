/*------------------------------------------------------------------------------
   About      : Represents a Mubble Client Installation.
   
   Created on : Sat Jun 24 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { SyncRequest } from '../master' 

/**
 * It is allowed to add members to this interface by extending it
 * Any new member must be either string or a number
 * plain objects 
 */
export interface ClientIdentity {

  uniqueId      : string    // Typically a version in 'a.b.c' format 

  // only valid when request is from Mubble (web)app
  appName       : string
  channel       : string
  appVersion    : string
  jsVersion     : string

  // only available when client is issued an identity
  clientId      : number
  userLinkId    : string
  userName      : string

  // TODO: Remove this
  firstName     : string
  lastName      : string
  // Information passed by the client used by   
  location      : string   // it is in form of serialized json object 
  networkType   : string

  syncReq      ?: SyncRequest
}

