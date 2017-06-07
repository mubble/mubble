/*------------------------------------------------------------------------------
   About      : Redis Instance wrapper
   
   Created on : Wed May 24 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {RedisClient , createClient , 
        ResCallbackT , Multi}           from 'redis'
import {log , concat}                   from './ma-util' 

//import {RedisBase , MasterBase}  from './masterbase'
function redisLog(...args : any[] ) : void {
  log(LOG_ID , ...args)
}
const LOG_ID = 'RedisWrapper'

//export type AsyncResp = {error : string , success : boolean}

export type redis_command = 'del' | 'expire' | 'get' | 'incr' | 'mget' | 'mset' | 'psetex' | 'set' | 'setex' | 'ttl' | 'quit' | 'info' |
                            'hdel' | 'hget' | 'hgetall' | 'hmget' | 'hmset' | 'hset' | 'exists' |
                            'lpush' | 'rpush' | 'lrange' |
                            'zadd' | 'zrange' | 'zrangebyscore' | 'zrem' |
                            'publish' | 'unsubscribe' | 
                            'watch' | 'unwatch' |
                            'scan' | 'sscan' | 'hscan' | 'zscan'

export const redis_commands : string[] =  
['del' , 'expire' , 'get' , 
 'hdel', 'hget',  'hgetall' , 'hmget', 'hmset' , 'hset' ,
 'zadd' , 'zrange' , 'zrangebyscore' , 'zrem'
 ]                            
                             
export type redis_async_func        = (...args : string[]) => void
export type redis_async_func_str    = (...args : string[]) => string[]
export type redis_async_func_arr    = (key: string , ...args : string[]) => string []
export type redis_async_func_map    = (key : string) => {[key:string] : string}  //Map<string , string>

export interface RedisCmds {
  
  del       : (...args : string[]) => void
  expire    : redis_async_func // check
  get       : (key: string ) => string
  incr      : redis_async_func // check
  mget      : (...args : string[]) => string []
  mset      : redis_async_func

  hdel      : (args : string[]) => void
  hget      : (key : string , field : string) => string 
  hgetall   : (key : string) => {[key:string] : string}
  hmget     : (key: string , ...args : string[]) => string []
  hmset     : (key: string , ...args : string[] ) => void
  hset      : (key: string , field : string , value : string ) => void

  // z sorted set apis 
  zadd            : (key: string , option : string , ...scoreValuePairs : any[]  ) => void
  zrange          : (key: string , start : number , end : number , withscore ?: string ) => string[]
  zrangebyscore   : (key: string , startscore : number | string , endscore : number | string , withscore ?: string ) => string[]
  zrem            : (key: string , ...keys : string[]  ) => void // check
  
}

function add(name : string)  {
  
  name = name.toLowerCase()
  const rw = (RedisWrapper.prototype as any)
  rw[name] = function() {
    
    const _     = this,
          keys  = Array.prototype.slice.call(arguments)
          
    return _._execute(name , keys)
  }
  return add
}


export class RedisWrapper {

  public redis       : RedisClient
  public monitoring  : boolean = false
  public info        : { [index : string] : string } = {}

  constructor(private name : string ){
    
  }
  // Unfortunately there is no static initializer like java in ts/js
  static initialize() : void {
    for(const cmd of redis_commands){
      // we can find all the function (name) of RedisClient from reflection . check signature type
      add(cmd)
    }
  }

  async connect(url : string , options ?: {max_attempts ?: number , connect_timeout ?: number} ) : Promise<any>{
    const _ = this
    await new Promise ((resolve : any , reject : any) => {
      
      this.redis = createClient(url , options)
      this.redis.on("connect" , ()=>{
        redisLog(this.name , 'connected to redis', url)
        resolve()
      })

      this.redis.on("error" , (error : any)=>{
        redisLog(this.name , 'Could not connect to redis ',url , error)
        reject(error)
      })
    })
    redisLog('checking redis version')
    await this._info()
    const redis_ver : string = this.info['redis_version']
    // Get this from env config
    const exp_redi_ver : string = '3.2.0'
    
    return (redis_ver === exp_redi_ver) ? Promise.resolve(redis_ver) : Promise.reject(concat('Incorrect Redis Version. Found:', redis_ver ,'Expected:', exp_redi_ver) )
    //return Promise.resolve(this.redis.server_info)
  }

  async subscribe(events : any[] , callback : (channel : string , message : string) => void ) {
    
    return new Promise ((resolve : any , reject : any) => {
      
      this.redis.on('subscribe' , (channel : string , count : number)=>{
        redisLog(this.name , ' subscribed to channel ' , channel , count)
        // resolve when ? all events are subscribed
      })

      this.redis.on('message' , (channel : string , message : string) => {
        callback(channel , message)
      })

      redisLog('redis ',this.name , 'subscribing to channels ',events)
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

  async _execute(cmd : redis_command , args ?: any[]) {
    const redisw = this.redis as any
    if(!redisw[cmd] || typeof redisw[cmd]!== 'function' ) throw Error('redis command '+cmd + ' invalid')
    
    return new Promise<any> ((resolve : any , reject : any) =>{
      
      redisw[cmd](args , (err : Error , res : any) =>{
        if(err){
          if(this.monitoring) redisLog(this.name , cmd  , args , 'failed ',err)
          reject(err)
        }
        if(this.monitoring) redisLog(this.name , cmd  , args , 'success ', res)
        resolve(res)
      })
    })

  }

  isMaster() {
    const _ = this
    return _.info['role'] === 'master'
  }

  isSlave() {
    const _ = this
    return _.info['role'] === 'slave'
  }

  async scan (pattern ?: string   , count ?: number) : Promise<Set<string>> {
    
    return this._scan('scan' , '' , 0 , pattern , count)
  }

  async sscan (key : string , pattern ?: string , count ?: number) : Promise<Set<string>> {
    
    return this._scan('sscan' , key , 0 , pattern , count)
  }

  async hscan(key : string , pattern ?: string , count ?: number) : Promise<Map<string , object >> {
    return this._hscan('hscan' , key , 0 , pattern , count)
  }
  
  async zscan(key : string , pattern ?: string , count ?: number) : Promise<Map<string , object>> {
    return this._hscan('zscan' , key , 0 , pattern , count)
  }


  async _scan(cmd : redis_command , key : string , cursor : number ,  pattern ?: string , count ?: number , out ?: Set<string>) : Promise<Set<string> > {
    const args : any[] = cmd === 'scan' ? [cursor] : [key , cursor]
    if(pattern) args.push('MATCH' , pattern)
    if(count) args.push('COUNT' , count)

    const res : any[] = await this._execute(cmd , args)
    cursor  = Number(res[0])
    if(!out) out = new Set<string>()
    for (const mem of <string[]> res[1]) out.add(mem)
    if(cursor === 0) return Promise.resolve(out)

    return this._scan(cmd , key , cursor , pattern , count , out)
  }

  async _hscan(cmd : redis_command , key : string , cursor : number ,  pattern ?: string , count ?: number , out ?: Map<string , object > ) : Promise<Map<string , object> > {
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
    if(cursor === 0) return Promise.resolve(out)

    return this._hscan(cmd , key , cursor , pattern , count , out)
  }

  multi() : Multi {
    return this.redis.multi()
  }
  
  async execMulti(batchOrMulti : Multi) {
    const _ = this
    
    return new Promise(function(resolve, reject) {
      
      batchOrMulti.exec(function(err, results) {
        if (_.monitoring)  redisLog ('multi/batch', {err}, 'results', results)
        if (err) return reject(err)
        resolve(results)
      })
    })
  }

  async del(...keys : string[] ) {
    return this._execute('del' , keys)
  }

  // todo : this
  async publish(channel : string , data : any) {

  }

  // Ignore
  async test()  {
    this.redis.subscribe()
    this.redis.scan()
    this.redis.hscan()

    await this.redisCommand().del(...['key1','key2'])
    await this.command('del' , [])
    await this.del('gk1' , 'gk2' )
    await this.del(...['gk1' , 'gk2'] )
    

  }
  
  async command(cmd : redis_command , args : any[]) {
    return this._execute(cmd , args)
  }
  
  redisCommand() : RedisCmds {
    //return <RedisCmds> <any> this
    return (this as any as RedisCmds)
  }





}



