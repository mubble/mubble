/*------------------------------------------------------------------------------
   About      : Google Trace Apis
   
   Created on : Tue Aug 08 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
 
import {
        format,
        Mubble
       }                            from '@mubble/core'
import {
        RunContextServer,
        RCServerLogger
       }                            from '../../rc-server'
import {GcloudEnv}                  from '../gcloud-env'
import * as lo                      from 'lodash'

const hashMap    : Mubble.uObject<number> = {},
      googleApis                          = require('googleapis')

export class TraceBase {

  public static authClient : any 
  public static cloudTrace : any
  public static projectId  : string
  public static _active    : boolean 
  
  public static async init(rc : RunContextServer, gcloudEnv : GcloudEnv) {
    this.cloudTrace = googleApis.cloudtrace('v1')
    if(gcloudEnv.projectId)
      this.projectId  = gcloudEnv.projectId
    this.authClient = await new Promise((resolve, reject) => {
      // This method looks for the GCLOUD_PROJECT and GOOGLE_APPLICATION_CREDENTIALS in environment variables.
      googleApis.auth.getApplicationDefault((err: any, authClient: any) => {
        if(err) {
          rc.isError() && rc.error(rc.getName(this), 'trace authentication failed: ', err)
          reject(err)
        }
        if(authClient.createScopedRequired && authClient.createScopedRequired()) {
          const scopes = ['https://www.googleapis.com/auth/cloud-platform']
          authClient = authClient.createScoped(scopes)
        }
        resolve(authClient)
      })
    })

    this._active = gcloudEnv.projectId ? true : false
  } 

  public static sendTrace(rc : RunContextServer, apiName : string , labels ?: Mubble.uObject<string>) {
    if(!this._active) rc.isDebug() && rc.debug(rc.getName(this), 'Trace Disabled')
    if(!rc.isTraceEnabled() || !this._active) return
    const trace   = this.createTrace(rc, apiName, labels),
          request = {
            projectId : TraceBase.projectId,
            resource  : {"traces": [trace]},
            auth      : TraceBase.authClient
          }
          
    TraceBase.cloudTrace.projects.patchTraces(request, (err : any) => {
      if (err) {
        rc.isError() && rc.error(rc.getName(this), 'trace sending error', err)
        return
      }
    }) 
  }

  public static createTrace(rc : RunContextServer, apiName : string, labels ?: Mubble.uObject<string>) {
    const logger = rc.logger,
          trace  = {
            projectId : TraceBase.projectId,
            traceId   : getTraceId(apiName),
            spans     : [
              {
                spanId    : "1",
                kind      : 'RPC_SERVER',
                name      : apiName,
                // Take care of 0 trace span
                startTime : format(new Date(logger.startTs), '%yyyy%-%mm%-%dd%T%hh%:%MM%:%ss%.%ms%000000Z', 0),
                endTime   : format(new Date(), '%yyyy%-%mm%-%dd%T%hh%:%MM%:%ss%.%ms%000000Z', 0),
                labels    : labels
              }
            ]
          }


    if(trace.spans[0].startTime===trace.spans[0].endTime){
      // 0 milisecond trace is not shown on tracelist. 
      // Hack to make the tracespan 1 milisecond ,so that it is shown on tracelist
      trace.spans[0].endTime = format(new Date(logger.startTs+1), '%yyyy%-%mm%-%dd%T%hh%:%MM%:%ss%.%ms%000000Z', 0)
    }      
    let spanIdCount : number = 1
    // We expect trace spans to be non-empty when error occurred. Label != null => error
    if(!lo.isEmpty(logger.traceSpans) && !labels){
      // when no error this should not happen
      throw new Error('trace not finished for apis '+ apiName + ' ' +  Object.keys(logger.traceSpans) )
    }

    if(!lo.isEmpty(logger.finishedTraceSpans)){
      for(let spanInfo of logger.finishedTraceSpans ){
        spanIdCount += 1
        trace.spans.push({
          spanId    : spanIdCount.toString(),
          kind      : 'RPC_SERVER',
          name      : spanInfo.id ,
          startTime : format(new Date(spanInfo.startTime), '%yyyy%-%mm%-%dd%T%hh%:%MM%:%ss%.%ms%000000Z', 0),
          endTime   : format(new Date(spanInfo.endTime), '%yyyy%-%mm%-%dd%T%hh%:%MM%:%ss%.%ms%000000Z', 0),
          labels    : undefined
        })
      }
    }
    return trace
  }
}

function hash(str : string) : number {
  var hash = 0, i, chr;
  if (str.length === 0) return hash;
  for (i = 0; i < str.length; i++) {
    chr   = str.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0
  }
  return Math.abs(hash)
}

function getHash(api : string) : number {
  if(hashMap[api]) return hashMap[api]
  const num = hash(api)
  hashMap[api] = num 
  return num 
}

let k = 0
function getCounter() : number{
  k++
  if(k>10000) k=0
  return k
}

export function getTraceId(api : string) : string {
  let str : string = ''+getHash(api)+''+Date.now()+''+getCounter() ,
      hexStr = str , 
      len = 32 - hexStr.length
  // Fill random hex-base number to make total length 32
  for(let i=0;i<len;i++){
    hexStr += lo.random(0 , 15).toString(16)
  }    
  return hexStr
}

function getDummyLabels() {
  if(Math.random()>0.5) return undefined
  return {
    gk1 : lo.random(1,10).toString(),
    gk2 : lo.random(11,20).toString(),
    err : "err"+lo.random(0,1),
    test : Math.random()>0.5 ? "testing" : undefined
  }
}

export function createDummyTrace(rc : RunContextServer) {
    const rand = lo.random(1,5),
    name = `six-feet-under${rand}`,
    apiDur = lo.random(0 , rand*1000),
    labels : any = getDummyLabels(),
    startTime : number = new Date(Date.now()- apiDur).getTime() ,
    endTime   : number = new Date().getTime() ,
    diff = Math.round((endTime -startTime)/8),
    trace  = {
      projectId : TraceBase.projectId ,
      traceId   : getTraceId(name) ,
      spans     : [
        {
          spanId    : "1" ,
          kind      : 'RPC_SERVER',
          name      : name ,
          startTime : format(startTime , '%yyyy%-%mm%-%dd%T%hh%:%MM%:%ss%.%ms%000000Z' , 0) ,
          endTime   : format(endTime , '%yyyy%-%mm%-%dd%T%hh%:%MM%:%ss%.%ms%000000Z', 0),
          //labels    : labels
        },
        {
          spanId    : "2" ,
          kind      : 'RPC_SERVER',
          name      : name + '_ind1' ,
          startTime : format(startTime + diff , '%yyyy%-%mm%-%dd%T%hh%:%MM%:%ss%.%ms%000000Z' , 0) ,
          endTime   : format(endTime - diff , '%yyyy%-%mm%-%dd%T%hh%:%MM%:%ss%.%ms%000000Z', 0),
          labels    : labels
        },
        {
          spanId    : "3" ,
          kind      : 'RPC_SERVER',
          name      : name + '_ind2' ,
          startTime : format(startTime + (2*diff) , '%yyyy%-%mm%-%dd%T%hh%:%MM%:%ss%.%ms%000000Z' , 0) ,
          endTime   : format(endTime - (2*diff) , '%yyyy%-%mm%-%dd%T%hh%:%MM%:%ss%.%ms%000000Z', 0),
          labels    : labels
        }
      ]
    }
    if(labels) (trace.spans[0] as any)["labels"] = labels
    return trace
}


export function dummyTrace(rc : RunContextServer) {
  for(let i = 0; i < 2; i++) {
    const trace   = createDummyTrace(rc),
          request = {
            projectId : TraceBase.projectId,
            resource  : {"traces": [trace]},
            auth      : TraceBase.authClient
          }

    rc.isDebug() && rc.debug(rc.getName(this), trace)
    TraceBase.cloudTrace.projects.patchTraces(request, (err : any) => {
      if(err) {
        rc.isError() && rc.error(rc.getName(this), 'trace sending error',err)
        return
      }
    })
  }
}
