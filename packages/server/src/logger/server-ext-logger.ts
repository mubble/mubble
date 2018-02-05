/*------------------------------------------------------------------------------
   About      : Logger Utility Class
   
   Created on : Thu Jun 15 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as path                           from 'path' 
import * as fs                             from 'fs'
import {WriteStream}                       from 'fs' 
import * as mkdirp                         from 'mkdirp'   

import {LOG_LEVEL  
        , format , set ,
        ExternalLogger , 
        Mubble }                           from '@mubble/core'
//import {isClusterMaster}                   from '@mubble/server'        
import {RunContextServer}                  from '../rc-server'

const ONE_DAY_MS  : number  = 1 * 24 * 60 * 60 * 1000 ,
      ONE_MINUTE_MS : number = 1 * 60 * 1000

const TZ_OFF_SET : number = -330

const ROTATION : Mubble.uObject<{TIMESTAMP_FORMAT : string , MS : number}> = {
  PER_DAY : {TIMESTAMP_FORMAT : '%yy%-%mm%-%dd%' , MS : ONE_DAY_MS},
  PER_MINUTE : {TIMESTAMP_FORMAT : '%yy%-%mm%-%dd%-%hh%:%MM%' , MS : ONE_MINUTE_MS},
  PER_FIVE_MINUTE : {TIMESTAMP_FORMAT : '%yy%-%mm%-%dd%-%hh%:%MM%' , MS : ONE_MINUTE_MS*5}
}

const ROTATION_LOGIC : string = 'PER_DAY'
          
const LOG_LEVEL_ACCESS : number = 10

const Log_Level_Map : number[][] = []

export class RcServerExtLogger extends ExternalLogger {

  private logPath     : string
  private dateTs      : string = ''

  private loggerMap   : FileEntry[] = []
  private timerId     : any
  
  async init (logBaseDir ?: string){
    
    this.logPath =  logBaseDir ? logBaseDir as string : path.join (process.cwd() , 'log')
    
    await mkdirp.sync(path.join(this.logPath , 'debug'))
    await mkdirp.sync(path.join(this.logPath , 'error'))
    await mkdirp.sync(path.join(this.logPath , 'access'))
    await mkdirp.sync(path.join(this.logPath , 'session'))


    Log_Level_Map[LOG_LEVEL.DEBUG]  = [LOG_LEVEL.DEBUG]
    Log_Level_Map[LOG_LEVEL.STATUS] = [LOG_LEVEL.DEBUG]
    Log_Level_Map[LOG_LEVEL.WARN]   = [LOG_LEVEL.DEBUG , LOG_LEVEL.ERROR]
    Log_Level_Map[LOG_LEVEL.ERROR]  = [LOG_LEVEL.DEBUG , LOG_LEVEL.ERROR]
    // No logging for Log level NONE
    Log_Level_Map[LOG_LEVEL.NONE]   = []

    Log_Level_Map[LOG_LEVEL_ACCESS]           = [LOG_LEVEL_ACCESS]

    this.setLogger()
  }

  private setRotationTimer() {
    const currDate = new Date() ,
          currTime = currDate.getTime() + (currDate.getTimezoneOffset() - TZ_OFF_SET) * 60 * 1000 
    
    const rem = ROTATION[ROTATION_LOGIC].MS - (currTime % ROTATION[ROTATION_LOGIC].MS)
    //console.log('setRotationTimer ', format(new Date(), '%dd%/%mm% %hh%:%MM%:%ss%.%ms%' , TZ_OFF_SET) , rem , Date.now())
    this.timerId = setTimeout( this.setLogger.bind(this) , rem +2000) // +2 second to be on safe side
  }

  private setLogger() {
    const dateStr : string = format(new Date() , ROTATION[ROTATION_LOGIC].TIMESTAMP_FORMAT , TZ_OFF_SET)
    //console.log('date str is ',dateStr , this.dateTs , format(new Date(), '%dd%/%mm% %hh%:%MM%:%ss%.%ms%' , TZ_OFF_SET) )
    if(dateStr === this.dateTs) {
      this.setRotationTimer()
      return
    }
    this.dateTs = dateStr

    const oldLoggerMap : FileEntry[] = this.loggerMap
    this.loggerMap = []

    const debugLogEntry : FileEntry = this.getNewFileEntry(dateStr , 'debug') ,
          errLogentry   : FileEntry = this.getNewFileEntry(dateStr , 'error') ,
          accLogEntry   : FileEntry = this.getNewFileEntry(dateStr , 'access') 

     this.loggerMap[LOG_LEVEL.DEBUG]  =  debugLogEntry
     this.loggerMap[LOG_LEVEL.ERROR]  =  errLogentry
     this.loggerMap[LOG_LEVEL_ACCESS] =  accLogEntry
     
      oldLoggerMap.forEach((entry : FileEntry) => {
        if(entry) entry.closeEntry()
      })
    
    this.setRotationTimer()    
  }

  private getNewFileEntry(dateStr : string , loglevel : string ) : FileEntry {
    
    const filename : string = path.join(this.logPath , loglevel , dateStr) + '.log' 
    return new FileEntry(filename , dateStr)
  }

  public log(level : LOG_LEVEL , logMsg: string ) {
    
    const loggerIndexes : number[] = Log_Level_Map[level]
    loggerIndexes.forEach((index : number)=>{
      
      const entry : FileEntry = this.loggerMap[index]
      if(!entry) {
        // most probabaly roration is in place
        console.error('logger entry not found ',level , logMsg)
        return
      }
      const stream : WriteStream = entry.stream
      
      if(!entry.destroyed && stream){
        // Todo : Put try catch
        stream.write(logMsg+'\n')
      }else{
        // create again the stream which might have been closed
        if(entry.destroyed) {
          console.error('entry destroyed',logMsg)
          return
        }else if(!stream){
          console.error('write stream closed. creating again',entry.fileName)
          
          if(entry.createStream(entry.fileName)){
            entry.stream.write(logMsg+'\n')
          }
        }

      }
    })
  }

  public sessionLog(sessionLogBuf: string, sessionFileName: string): void {
    const filename : string = path.join(this.logPath , 'session', sessionFileName) + '.log'
    fs.writeFile(filename , sessionLogBuf , {flag: 'a'} , (err)=>{
      if(err){console.error('log writing error',err)}
    })
  }

  public accessLog(logBuf: string): void {
    this.log(LOG_LEVEL_ACCESS , logBuf)
  }

  public async close() {
    for(const entry of this.loggerMap) {
      if(entry) await entry.closeStream()
    }
    clearTimeout(this.timerId)
  }

}


class FileEntry {

 fileName   : string 
 dateStr    : string 
 stream     : WriteStream
 destroyed  : boolean 

 constructor(filename : string , dateStr : string) {
   
   this.fileName  = filename 
   this.dateStr   = dateStr 
   this.destroyed = false
   this.createStream(this.fileName)
 }

 public createStream(filename : string ) : WriteStream {
   
  let stream : WriteStream = null as any
  try{

      stream =  fs.createWriteStream(filename , {flags : 'a'})
    
      stream.on('error' , (err :any)=> {
    
      console.error('received error:' + err, 'while writing log:' + this.fileName)
      if(this.stream){
        try{
          this.stream.close()
        }catch(err){
          console.error('stream closing error ',err , this.fileName)
        }
      }
      this.stream = null as any
    })
  }catch(err)
  {
    console.error('Write stream creation error ',err , filename)
    return null as any
  }
  
  this.stream = stream
  return stream

 }

 async closeEntry() {
  //console.log('closing entry',this.fileName)
  try{
    
    this.destroyed = true
    this.fileName = null as any
    this.dateStr  = null as any
    
    if(this.stream){
      this.stream.end()
      this.stream.close()
      this.stream = null as any
    }
  }catch(err){
    console.error('received error:' + err, 'while closing log file:' + this.fileName)
  }

 } 

 async closeStream() {
   
   try{
    await this.stream.close()
   }catch(err){
     console.log('stream closure failure',this.fileName)
   }
   this.destroyed = true
   this.fileName = null as any
   this.dateStr  = null as any
 }

}