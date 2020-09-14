/*------------------------------------------------------------------------------
   About      : Connection Map
   
   Created on : Wed Feb 27 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import { ConnectionInfo } from '@mubble/core'

export namespace ConnectionMap {

  const ActiveConnectionMap : Map<number | string, ConnectionInfo> = new Map()

  export function addActiveConnection(clientId : number | string, ci : ConnectionInfo) {
    if(isActiveConnection(clientId)) return

    ActiveConnectionMap.set(clientId, ci)
  }

  export function getActiveConnection(clientId : number | string) {
    return ActiveConnectionMap.get(clientId)
  }

  export function isActiveConnection(clientId : number | string) {
    return ActiveConnectionMap.has(clientId)
  }

  export function removeActiveConnection(clientId : number | string) {
    if(!isActiveConnection(clientId)) return
    
    ActiveConnectionMap.delete(clientId)
  }
}