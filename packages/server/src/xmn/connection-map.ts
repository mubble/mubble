/*------------------------------------------------------------------------------
   About      : Connection Map
   
   Created on : Wed Feb 27 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import { 
         Mubble,
         ConnectionInfo
       }                  from '@mubble/core'

export type ConnectionObject = {
  ci  : ConnectionInfo
  obj : Mubble.uObject<any>
}

export namespace ConnectionMap {

  const ActiveConnectionMap : Map<number | string, ConnectionObject> = new Map()

  export function addActiveConnection(id : number | string, ci : ConnectionObject) {
    if(isActiveConnection(id)) return

    ActiveConnectionMap.set(id, ci)
  }

  export function getActiveConnection(id : number | string) : ConnectionObject | undefined {
    return ActiveConnectionMap.get(id)
  }

  export function isActiveConnection(id : number | string) {
    return ActiveConnectionMap.has(id)
  }

  export function removeActiveConnection(id : number | string) {
    if(!isActiveConnection(id)) return
    
    ActiveConnectionMap.delete(id)
  }
}