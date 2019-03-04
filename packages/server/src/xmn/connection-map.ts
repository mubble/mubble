/*------------------------------------------------------------------------------
   About      : Connection Map
   
   Created on : Wed Feb 27 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import { ConnectionInfo } from '@mubble/core'

export namespace ConnectionMap {

  const CdConnectionMap : Map<number, ConnectionInfo> = new Map()

  export function addActiveConnection(clientId : number, ci : ConnectionInfo) {
    if(isActiveConnection(clientId)) return

    CdConnectionMap.set(clientId, ci)
  }

  export function getActiveConnection(clientId : number) {
    return CdConnectionMap.get(clientId)
  }

  export function isActiveConnection(clientId : number) {
    return CdConnectionMap.has(clientId)
  }

  export function removeActiveConnection(clientId : number) {
    if(!isActiveConnection(clientId)) return
    
    CdConnectionMap.delete(clientId)
  }
}