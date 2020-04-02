/*------------------------------------------------------------------------------
   About      : Connection Map
   
   Created on : Wed Feb 27 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import { 
         Mubble,
         ConnectionInfo
       }                    from '@mubble/core'
import { RunContextServer } from '../rc-server'
       
export type ConnectionObject = {
  ci  : ConnectionInfo
  obj : Mubble.uObject<any>
}
export namespace ConnectionMap {

  const ActiveConnectionMap : Map<number | string, ConnectionObject> = new Map()

  export function addActiveConnection(rc : RunContextServer, id : number | string, co : ConnectionObject) {
    rc.isDebug() && rc.debug(rc.getName(this), 'addActiveConnection', id, co)

    ActiveConnectionMap.set(id, co)
  }

  export function getActiveConnection(rc : RunContextServer, id : number | string) : ConnectionObject | undefined {
    const co = ActiveConnectionMap.get(id)
    rc.isDebug() && rc.debug(rc.getName(this), 'getActiveConnection', id, co)

    return co
  }

  export function removeActiveConnection(rc : RunContextServer, id : number | string) {
    rc.isDebug() && rc.debug(rc.getName(this), 'removeActiveConnection', id)

    if(!isActiveConnection(id)) {
      rc.isDebug() && rc.debug(rc.getName(this), 'No active connection present.', id)
      return
    }

    ActiveConnectionMap.delete(id)
  }

  // private method
  function isActiveConnection(id : number | string) {
    return ActiveConnectionMap.has(id)
  }
}