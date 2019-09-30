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
import { RedisWrapper }     from '../cache'

export type ConnectionObject = {
  ci  : ConnectionInfo
  obj : Mubble.uObject<any>
}

const CONN_MAP_PREFIX = 'connection-map:'

export namespace ConnectionMap {

  let connRedis : RedisWrapper
  let mapKey    : string

  export function init(serverId : string, redis : RedisWrapper) {
    connRedis = redis
    mapKey    = CONN_MAP_PREFIX + serverId
  }

  export async function addActiveConnection(id : string, co : ConnectionObject) {
    if(await isActiveConnection(id)) return

    await connRedis.redisCommand().hset(mapKey, id, JSON.stringify(co))
  }

  export async function getActiveConnection(id : string) : Promise<ConnectionObject | undefined> {
    const coStr = await connRedis.redisCommand().hget(mapKey, id)

    if(!coStr) return undefined
    return JSON.parse(coStr)
  }

  export async function isActiveConnection(id : string) : Promise<boolean> {
    return !!await connRedis.redisCommand().hexists(mapKey, id)
  }

  export async function removeActiveConnection(id : string) {
    await connRedis.redisCommand().hdel(mapKey, id)
  }
}