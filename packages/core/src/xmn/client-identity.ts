/*------------------------------------------------------------------------------
   About      : Represents a Mubble Client Installation
   
   Created on : Sat Jun 24 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

/**
 * It is allowed to add members to this interface by extending it
 * Any new member must be either string or a number
 * plain objects and arrays can also be supported on need basis
 */
export interface ClientIdentity {

  appName       : string
  channel       : string
  appVersion    : string
  jsVersion     : string

  // only available when client is issued an identity
  clientId      : number
  userLinkId    : string
  userName      : string
}

