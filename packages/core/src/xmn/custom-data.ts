/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Tue Feb 12 2019
   Author     : Siddharth Garg
   
   Copyright (c) 2019 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

export interface CustomData {
 
  // only valid when request is from Mubble (web)app
  appName         : string
  channel         : string
  appVersion      : string
  jsVersion       : string

  // only available when client is issued an identity
  clientId        : number
  appUserId       : string
  sessionId       : string
  deviceId        : string

  userLinkId      : string // TODO: remove
  uniqueId        : string // TODO: remove

  location        : string // serialised JSON Object
  networkType     : string

  publicRequest  ?: boolean
}