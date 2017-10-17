/*------------------------------------------------------------------------------
   About      : Redis Instance wrapper
   
   Created on : Wed May 24 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {
        RedisClient,
        createClient, 
        ResCallbackT,
        Multi
       }                                from 'redis'
import {
        log,
        concat
       }                                from '../master/ma-util' 
import {RunContextServer}               from '../rc-server'
import * as lo                          from 'lodash'

import {Mubble}                         from '@mubble/core'


function redisLog(rc : RunContextServer , ...args : any[] ) : void {
  if(rc){
    rc && rc.isStatus() && rc.status(rc.getName(this), LOG_ID , ...args)
  }else{
    log(LOG_ID , ...args)
  }
}

const LOG_ID = 'RedisWrapper'

export class RedisCmds {
  
  del       (...args : string[]) : Promise<number> {return true as any}
  expire    (...args : string[]) : Promise<void> {return true as any}
  get       (key : string ) : Promise<string> {return true as any}
  set       (key : string, value: string, ...options: string[]) : Promise<string> {return true as any}
  incr      (...args : string[]) : Promise<void> {return true as any}

  mget      (...args : string[]) : Promise<string []> {return true as any}
  mset      (...args : string[]) : Promise<void> {return true as any}

  hdel      (key : string , ...args : string[]) : Promise<void> { return true as any }
  hget      (key : string , field : string) : Promise<string> { return true as any }
  hgetall   (key : string) : Promise<{[key:string] : string}> { return true as any }
  hscan     (key : string , ...args : string[]) : Promise<[string, string []]> { return true as any }
  hmget     (key : string , ...args : string[]) : Promise<string []> { return true as any }
  hmset     (key : string , ...args : string[] ) : Promise<void> { return true as any }
  hset      (key : string , field : string , value : string | number) : Promise<number> { return true as any }
  hsetnx    (key : string , field : string , value : string | number) : Promise<number> { return true as any }
  hincrby   (key : string , field : string, incr : number) : Promise<number>  { return true as any }
  
  // z sorted set apis 
  zadd      (key : string , option : string , ...scoreValuePairs : any[]) : Promise<number> { return true as any }
  zrange    (key : string , start : number , end : number , withscore ?: string) : Promise<string[]> { return true as any }
  zrem      (key : string , ...keys : string[]) : Promise<void> { return true as any }
  zremrangebyscore (key : string , start : string , end : string) : Promise<void> { return true as any }
  zcount    (key : string , start : string , end : string) : Promise<number> { return true as any }
  zcard     (key: string) : Promise<number> { return true as any }

  exists    (key : string , ...keys : string[]) : Promise<boolean> { return true as any }
  zrangebyscore (key : string , start : number , end : number, ...args: string[]) : Promise<string[]> {return true as any}
  zrevrangebyscore (key : string , start : string , end : string, ...args: string[]) : Promise<string[]> {return true as any}

}

export type RedisMulti = RedisCmds

function add(name : string)  {
  
  name = name.toLowerCase()
  
  const rw : any = RedisWrapper.prototype
  rw[name] = function(...params: any[]) {
    const _ : RedisWrapper  = this
    return _._execute(name , params)
  }

  const rdMulti : any = RedisMultiWrapper.prototype
  rdMulti[name] = function(...params : any[]) {
    const _ : RedisMultiWrapper = this
    _.buff.push({cmdName : name , params : params})
    return (_.multi as any)[name](params)
  }  

  return add
}


export class RedisWrapper {

  public redis       : RedisClient
  public monitoring  : boolean = false
  public info        : Mubble.uObject<string> = {}
  static inited      : boolean = false
  constructor(private name : string, private rc : RunContextServer ){
  }
  // Unfortunately there is no static initializer like java in ts/js
  static init(rc : RunContextServer) : void {
    if(RedisWrapper.inited) return
    
    const cmds : string [] = Object.getOwnPropertyNames(RedisCmds.prototype).filter((cmd : string)=>{
      return (cmd !== 'constructor') && typeof((RedisCmds.prototype as any)[cmd]) === 'function' 
    })
    for(const cmd of cmds){
      // we can find all the function (name) of RedisClient from reflection . check signature type
      add(cmd)
    }
    RedisWrapper.inited = true
  }

  static async connect(rc : RunContextServer , name : string , url : string , options ?: {max_attempts ?: number , connect_timeout ?: number} ) : Promise<RedisWrapper>{
    
    const redisWrapper : RedisWrapper = new RedisWrapper(name , rc)
    await redisWrapper._connect(url , options)
    return redisWrapper
    
  }

  private async _connect(url : string , options ?: {max_attempts ?: number , connect_timeout ?: number}) {
    
    await new Promise ((resolve : any , reject : any) => {
      
      this.redis = createClient(url , options)
      this.redis.on("connect" , ()=>{
        redisLog(this.rc , this.name , 'connected to redis', url)
        resolve()
      })

      this.redis.on("error" , (error : any)=>{
        redisLog(this.rc , this.name , 'Could not connect to redis ',url , error)
        reject(error)
      })
    })
    await this._info()
  }

  async getRedisVersion() : Promise<string> {
    if(lo.size(this.info)){
      return this.info['redis_version']
    }
    
    redisLog(this.rc , 'checking redis version')
    await this._info()
    return this.info['redis_version']
  }

  async subscribe(events : string[] , callback : (channel : string , message : string) => void ) {
    
    return new Promise ((resolve : any , reject : any) => {
      
      this.redis.on('subscribe' , (channel : string , count : number)=>{
        redisLog(this.rc , this.name , ' subscribed to channel ' , channel , count)
        // resolve when ? all events are subscribed
        resolve()
      })

      this.redis.on('message' , (channel : string , message : string) => {
        callback(channel , message)
      })

      redisLog(this.rc , 'redis ',this.name , 'subscribing to channels ',events)
      this.redis.subscribe(events)

    })
  }

  async _info() {
    const _             = this,
          info : string = await this._execute('info'),
          ar : string[] = info.split('\n')

    ar.forEach(function(str) {
      const strParts : string[] = str.split(':')
      if (strParts.length !== 2) return
      _.info[strParts[0]] = strParts[1].trim()
    })
  }

  async flushRedis() {
    return this._execute('flushall',[]) 
  }

  async _execute(cmd : string , args ?: any[]) {
    const redisw = this.redis as any
    if(!redisw[cmd] || typeof redisw[cmd]!== 'function' ) throw Error('redis command '+cmd + ' invalid')
    
    return new Promise<any> ((resolve : any , reject : any) =>{
      
      redisw[cmd](args , (err : Error , res : any) =>{
        if(err){
          if(this.monitoring) redisLog(this.rc , this.name , cmd  , args , 'failed ',err)
          reject(err)
        }
        if(this.monitoring) redisLog(this.rc , this.name , cmd  , args , 'success ', res)
        resolve(res)
      })
    })

  }

  isMaster() : boolean {
    return this.info['role'] === 'master'
  }

  isSlave() : boolean {
    return this.info['role'] === 'slave'
  }

  async rwScan(pattern ?: string, count ?: number) : Promise<Set<string>> { 
    return this._scan('scan' , '' , 0 , pattern , count)
  }

  async rwSscan(key : string, pattern ?: string, count ?: number) : Promise<Set<string>> {
    return this._scan('sscan' , key , 0 , pattern , count)
  }

  async rwHscan(key : string, pattern ?: string, count ?: number) : Promise<Map<string , object >> {
    return this._hscan('hscan' , key , 0 , pattern , count)
  }
  
  async rwScanCb(params: any, cbFunc: (key: string, value: any) => void) : Promise<void> {
    return this._scanCb('scan' , '' , params, cbFunc)
  }
  
  async rwHscanCb(key : string, params: any, cbFunc: (key: string, value: any) => void) : Promise<void> {
    return this._scanCb('hscan' , key , params, cbFunc)
  }
  
  async rwZscan(key : string, pattern ?: string, count ?: number) : Promise<Map<string , object>> {
    return this._hscan('zscan' , key , 0 , pattern , count)
  }

  async rwZrange(key: string, start : string|number, end : string|number, withscore : boolean ) : Promise<Array<any>> {
    let redis_cmd = [key, start, end] as Array<any>
    if (withscore) redis_cmd.push ('WITHSCORES')
    return this._execute('zrange', redis_cmd) 
  }

  async rwZrevrange(key: string, start : string|number, end : string|number, withscore : boolean ) : Promise<Array<any>> {
    let redis_cmd = [key, start, end] as Array<any>
    if (withscore) redis_cmd.push ('WITHSCORES')
    return this._execute('zrevrange', redis_cmd) 
  }

  async rwZrangebyscore(key: string, start : string|number, end : string|number, withscore : boolean, offset ?: number, limit ?: number ) : Promise<Array<any>> {
    let redis_cmd = [key, start, end] as Array<any>
    if (withscore) redis_cmd.push ('WITHSCORES')
    if (limit) redis_cmd = redis_cmd.concat (['LIMIT', offset, limit])
    return this._execute('zrangebyscore', redis_cmd) 
  }

  async rwZrevrangebyscore(key: string, start : string|number, end : string|number, withscore : boolean, offset ?: number, limit ?: number ) : Promise<Array<any>> {
    let redis_cmd = [key, start, end] as Array<any>
    if (withscore) redis_cmd.push ('WITHSCORES')
    if (limit) redis_cmd = redis_cmd.concat (['LIMIT', offset, limit])
    return this._execute('zrevrangebyscore', redis_cmd) 
  }

  async rwZremrangebyscore(key: string, start : string|number, end : string|number ) : Promise<Array<any>> {
    let redis_cmd = [key, start, end] as Array<any>
    return this._execute('zrevrangebyscore', redis_cmd) 
  }

  async _scanCb(cmd : string , key : string, params: any, cbFunc: (key: string, value: any) => void) : Promise<void> {
    let cursor         = 0
    const args : any[] = (cmd.toLowerCase() === 'scan') ? [cursor] : [key , cursor]
    const cursorIdx    = (cmd.toLowerCase() === 'scan') ? 0        : 1
    if(params.pattern) args.push('MATCH' , params.pattern)
    if(params.count) args.push('COUNT' , params.count)
    
    do {
      const res  : any[] = await this._execute(cmd , args)
      cursor  = Number(res[0])
      if (cmd.toLowerCase() === 'scan') {
        const scanres = await this.redisCommand().mget (...res[1])
        for (let idx in <string[]> scanres) cbFunc (idx, JSON.parse(scanres[idx]))
      }
      else if (cmd.toLowerCase() === 'sscan') {
        for (let idx in <string[]> res[1]) cbFunc (idx, JSON.parse(res[1][idx]))
      }
      else {
        const resMapArr : string [] =  <string[]> res[1]
        for(let i=0 ; i<resMapArr.length ; i = i+2) cbFunc (resMapArr[i] , JSON.parse(resMapArr[i+1]))
      }
      args[cursorIdx] = cursor // Update cursor in the command...
    } while (cursor)
  }
  
  async _scan(cmd : string , key : string, cursor : number, pattern ?: string, count ?: number, out ?: Set<string>) : Promise<Set<string> > {
    const args : any[] = cmd === 'scan' ? [cursor] : [key , cursor]
    if(pattern) args.push('MATCH' , pattern)
    if(count) args.push('COUNT' , count)

    const res : any[] = await this._execute(cmd , args)
    cursor  = Number(res[0])
    if(!out) out = new Set<string>()
    for (const mem of <string[]> res[1]) out.add(mem)
    if(cursor === 0) return out

    return this._scan(cmd , key , cursor , pattern , count , out)
  }

  async _hscan(cmd : string, key : string, cursor : number, pattern ?: string, count ?: number, out ?: Map<string, object >) : Promise<Map<string , object> > {
    const args : any[] = [key , cursor]
    if(pattern) args.push('MATCH' , pattern)
    if(count) args.push('COUNT' , count)

    const res : any[] = await this._execute(cmd , args)
    cursor  = Number(res[0])
    if(!out) out = new Map<string , object>()
    const resMapArr : string [] =  <string[]> res[1]
    for(let i=0 ; i<resMapArr.length ; i = i+2){
      out.set(resMapArr[i] , JSON.parse(resMapArr[i+1]))
    }
    if(cursor === 0) return out

    return this._hscan(cmd, key, cursor, pattern, count, out)
  }

  private async execMulti(batchOrMulti : Multi) : Promise<any[]> {
    const _ = this
          
    return new Promise<any[]>(function(resolve, reject) {
      
      batchOrMulti.exec(function(err, results : any[]) {
        if (_.monitoring)  redisLog (this.rc , 'multi/batch', {err}, 'results', results)
        if (err) return reject(err)
        resolve(results)
      })
    })
  }

  // This is not an async api
  publish(channel : string , data : any) {
    this.redis.publish(channel , data)
  }

  redisCommand() : RedisCmds {

    return (this as any as RedisCmds)
  }

  redisMulti() : RedisMulti {

    return (new RedisMultiWrapper(this) as any as RedisMulti)
  }

  async execRedisMulti(redisMulti : RedisMulti) : Promise<any[]> {
    
    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), redisMulti instanceof RedisMultiWrapper , 'execRedisMulti can only exec redisMulti cmds')
    return this.execMulti( (redisMulti as any as RedisMultiWrapper).multi )
  }

  async close() {
    await this.redis.quit()
    redisLog(this.rc , 'closed redis connection ',this.name)
  }

}

class RedisMultiWrapper {
  public multi : Multi 
  public buff : any[] = []
  
  public constructor(private rw : RedisWrapper) {
    this.multi = rw.redis.multi()
  }

  public toString() : string {
    let tempBuf : string = ''
    this.buff.forEach(x=>{
      tempBuf += JSON.stringify(x) + '\n'
    })
    return tempBuf
  }
}



