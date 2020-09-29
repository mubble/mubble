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

const CLASS_NAME = 'ConnectionMap'

export namespace ConnectionMap {

  const activeConnectionMap : Map<number | string, ConnectionObject> = new Map()

  export function addActiveConnection(rc : RunContextServer, id : number | string, co : ConnectionObject) {
    rc.isDebug() && rc.debug(CLASS_NAME, 'addActiveConnection', id, co)

    if(isActiveConnection(id)) {
      rc.isWarn() && rc.warn(CLASS_NAME, 'Active connection already present.', id)
      return
    }

    activeConnectionMap.set(id, co)
  }

  export function getActiveConnection(rc : RunContextServer, id : number | string) : ConnectionObject | undefined {
    const co = activeConnectionMap.get(id)
    rc.isDebug() && rc.debug(CLASS_NAME, 'getActiveConnection', id, co)

    return co
  }

  export function removeActiveConnection(rc : RunContextServer, id : number | string) {
    rc.isDebug() && rc.debug(CLASS_NAME, 'removeActiveConnection', id)

    if(!isActiveConnection(id)) {
      rc.isWarn() && rc.warn(CLASS_NAME, 'No active connection present.', id)
      return
    }

    activeConnectionMap.delete(id)
  }

  // private method
  function isActiveConnection(id : number | string) {
    return activeConnectionMap.has(id)
  }
}