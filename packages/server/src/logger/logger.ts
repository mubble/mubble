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

import {LOG_LEVEL , RunContextBase 
        , format}                          from '@mubble/core'
import {RunContextServer}                  from '../rc-server'
 
function asNumber(level : LOG_LEVEL) : number {
  return level as number 
}

const Log_Level_Map : number[][] = []

export class GlobalLogger {

  private level       : LOG_LEVEL
  private logPath     : string
  private dateNum     : number = -1

  private loggerMap   : FileEntry[] = []
  
  init (rc : RunContextServer , level : LOG_LEVEL){
    
    // Get logging directory from rc env : TODO
    
    mkdirp.sync(path.join(this.logPath , 'debug'))
    mkdirp.sync(path.join(this.logPath , 'error'))
    mkdirp.sync(path.join(this.logPath , 'access'))
    
    Log_Level_Map[asNumber(LOG_LEVEL.DEBUG)]  = [asNumber(LOG_LEVEL.DEBUG)]
    Log_Level_Map[asNumber(LOG_LEVEL.STATUS)] = [asNumber(LOG_LEVEL.DEBUG)]
    Log_Level_Map[asNumber(LOG_LEVEL.WARN)]   = [asNumber(LOG_LEVEL.DEBUG) , asNumber(LOG_LEVEL.ERROR)]
    Log_Level_Map[asNumber(LOG_LEVEL.ERROR)]  = [asNumber(LOG_LEVEL.DEBUG) , asNumber(LOG_LEVEL.ERROR)]

    Log_Level_Map[asNumber(LOG_LEVEL.NONE)] = [asNumber(LOG_LEVEL.NONE)]

    this.setLogger()

  }

  private setLogger() {
    
    const date : number = new Date().getDate()
    if(date === this.dateNum) return
    const dateStr : string = format(new Date() , '%yy%-%mm%-%dd%')
    
    const oldLoggerMap : FileEntry[] = this.loggerMap
    this.loggerMap = []

    const debugLogEntry : FileEntry = this.getNewFileEntry(dateStr , 'debug') ,
          errLogentry   : FileEntry = this.getNewFileEntry(dateStr , 'error') ,
          accLogEntry   : FileEntry = this.getNewFileEntry(dateStr , 'access') 

     this.loggerMap[asNumber(LOG_LEVEL.DEBUG)] =  debugLogEntry
     this.loggerMap[asNumber(LOG_LEVEL.ERROR)] =  errLogentry
     this.loggerMap[asNumber(LOG_LEVEL.NONE)]  =  accLogEntry

      oldLoggerMap.forEach((entry : FileEntry) => {
        entry.close()
        entry.reset()
      })
     
  }

  private getNewFileEntry(dateStr : string , loglevel : string ) : FileEntry {
    
    const filename : string = path.join(this.logPath , loglevel , dateStr) + '.log' ,
    stream : WriteStream =  fs.createWriteStream(filename , {flags : 'a'}),
    entry : FileEntry = new FileEntry(filename , dateStr , stream)
    return entry
  }

  public log(level : LOG_LEVEL , logMsg: string ) {
    const loggerIndexes : number[] = Log_Level_Map[asNumber(level)]

    loggerIndexes.forEach((index : number)=>{
      
      const entry : FileEntry = this.loggerMap[index]
      if(!entry) {
        // most probabaly roration is in place
        console.error('logger entry not found ',level , logMsg)
        return
      }
      const stream : WriteStream = entry.stream
      
      if(stream){
        // Todo : Put try catch
        stream.write(logMsg)
      }else{
        // create again the stream which might have been closed

      }
    })
  }


}


class FileEntry {

 fileName : string | null
 dateStr  : string | null
 stream   : WriteStream 

 constructor(filename : string , dateStr : string , stream : WriteStream) {
   
   this.fileName = filename 
   this.dateStr  = dateStr 
   this.stream   = stream

   this.stream.on('error' , (err :any)=> {
     console.error('received error:' + err, 'while writing log:' + this.fileName)
     this.reset()
   })

 }

 reset() : void {
   
   this.fileName = null
   this.dateStr  = null
   this.stream   = null as any
 }

 close() : void {
  
  try{
    
    if(this.stream){
      this.stream.end()
      this.stream.close()
      this.stream = null as any
    }
  }catch(err){
    console.error('received error:' + err, 'while closing log file:' + this.fileName)
  }

 } 

}