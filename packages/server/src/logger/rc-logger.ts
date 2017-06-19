/*------------------------------------------------------------------------------
   About      : Basic Access Logger Server
   
   Created on : Mon Jun 19 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {RunContextServer}     from '../rc-server'
import {LOG_LEVEL  
        , format , set 
        , ExternalLogger}     from '@mubble/core'



export class RCLogger extends ExternalLogger {
  
  
  public constructor(public rc : RunContextServer) {
    super()
  }

  public log(level : LOG_LEVEL , logMsg : String): void {
    

  }

  public sessionLog(sessionLogBuf: string, sessionFileName: string): void {

  }
  
  public accessLog(logBuf: string): void {

  }
}        

