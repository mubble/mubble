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
        , format , set}                    from '@mubble/core'
import {RunContextServer}                  from '../rc-server'

const ONE_DAY_MS  : number  = 1 * 24 * 60 * 60 * 1000 

function asNumber(level : LOG_LEVEL) : number {
  return level as number 
}

const Log_Level_Map : number[][] = []

export class GlobalLogger {

  private level       : LOG_LEVEL
  private logPath     : string
  private dateNum     : number = -1

  private loggerMap   : FileEntry[] = []
  
  async init (rc : RunContextServer , level : LOG_LEVEL){
    
    // Get logging directory from rc env : TODO
    this.logPath =  path.join (process.cwd() , 'log')
    
    await mkdirp.sync(path.join(this.logPath , 'debug'))
    await mkdirp.sync(path.join(this.logPath , 'error'))
    await mkdirp.sync(path.join(this.logPath , 'access'))
    await mkdirp.sync(path.join(this.logPath , 'session'))


    Log_Level_Map[asNumber(LOG_LEVEL.DEBUG)]  = [asNumber(LOG_LEVEL.DEBUG)]
    Log_Level_Map[asNumber(LOG_LEVEL.STATUS)] = [asNumber(LOG_LEVEL.DEBUG)]
    Log_Level_Map[asNumber(LOG_LEVEL.WARN)]   = [asNumber(LOG_LEVEL.DEBUG) , asNumber(LOG_LEVEL.ERROR)]
    Log_Level_Map[asNumber(LOG_LEVEL.ERROR)]  = [asNumber(LOG_LEVEL.DEBUG) , asNumber(LOG_LEVEL.ERROR)]

    Log_Level_Map[asNumber(LOG_LEVEL.NONE)]   = [asNumber(LOG_LEVEL.NONE)]

    this.setLogger()

  }

  private setRotationTimer() {
    const dateStr : string = format(new Date() , '%yy%-%mm%-%dd%') ,
          currDate : Date  = new Date()
    
    set(currDate , dateStr , '%yy%-%mm%-%dd%')
    const nextDateMs : number = currDate.getTime() + ONE_DAY_MS 

    setTimeout( this.setLogger.bind(this) , nextDateMs - Date.now())
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
        entry.closeEntry()
      })
    this.setRotationTimer() 
  }

  private getNewFileEntry(dateStr : string , loglevel : string ) : FileEntry {
    
    const filename : string = path.join(this.logPath , loglevel , dateStr) + '.log' 
    return new FileEntry(filename , dateStr)
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
      
      if(!entry.distroyed && stream){
        // Todo : Put try catch
        stream.write(logMsg+'\n')
      }else{
        // create again the stream which might have been closed
        if(entry.distroyed) {
          console.error('entry distroyed',logMsg)
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


}


class FileEntry {

 fileName   : string 
 dateStr    : string 
 stream     : WriteStream
 distroyed  : boolean 

 constructor(filename : string , dateStr : string) {
   
   this.fileName  = filename 
   this.dateStr   = dateStr 
   this.distroyed = false
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

 closeEntry() : void {
  //console.log('closing entry',this.fileName)
  try{
    
    this.distroyed = true
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

}