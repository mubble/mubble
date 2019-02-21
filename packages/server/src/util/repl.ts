/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri Apr 14 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { 
         ConnectionInfo,
         WireObject,
         Protocol,
         WIRE_TYPE,
         XmnProvider,
         HTTP,
         Mubble,
         CustomData
       }                              from '@mubble/core'
import { RunContextServer }           from '../rc-server'
import { XmnRouterServer }            from '../xmn/xmn-router-server'
import * as repl                      from 'repl'
import * as path                      from 'path'
import * as fs                        from 'fs'
import * as lo                        from 'lodash'

// Import from external modules without types
const replHistory: any = require('repl.history') // https://github.com/ohmu/node-posix


export abstract class Repl {
  
  protected ci         : ConnectionInfo
  protected replServer : any
  protected provider   : ReplProvider

  constructor(protected rc: RunContextServer, private clientIdentity: Mubble.uObject<any>) {
    this.ci = this.getConnectionInfo()
    this.provider = this.ci.provider as ReplProvider
  }

  abstract async callApi(apiName: string, param: object , ncInstanceId ?: number , userLinkId ?: string) : Promise<any>

  init(context ?: any) {

    return new Promise((resolve, reject) => {
      
      if (!context) context = {}

      context.fs       = fs
      context.path     = path
      context.lo       = lo
      context.$        = this
      context.rc       = this.rc
      context.ci       = this.ci

      this.replServer = repl.start({prompt: 'mubble > ', useGlobal: true})
      replHistory(this.replServer, process.env.HOME + '/.mubble-repl')

      Object.assign((this.replServer as any).context, context)
      this.replServer.on('exit', function () {
        resolve()
      })

      this.replServer.on('error', (err: Error) => {
        reject(err)
      })
    })
  }

  _print(...args: any[]) {
    args.forEach((val, index) => {
      this.rc.status('repl', val, typeof(val))
    })
  }
  
  print(pr: Promise<any>) {
    
    let _       = this,
        ts      = Date.now()
        
    return pr.then( function() {
      console.log('Success...', Date.now() - ts, 'ms')
      _._print(...arguments)
    }, function() {
      console.log('Failed!', Date.now() - ts, 'ms')
      _._print(...arguments)
    })
  }

  set pr(pr: Promise<any>) {
    this.print(pr)
  }

  createNewConnectionInfo(clientIdentity : CustomData) {
    this.ci = this.getConnectionInfo ()
    this.ci.customData = clientIdentity
    this.provider = this.ci.provider as ReplProvider
  }

  getConnectionInfo() {
    const ci = {
      shortName   : '',
      protocol    : Protocol.WEBSOCKET,
      host        : 'localhost',
      port        : 1234,
      url         : '/api/DummyApi',
      headers     : {},
      ip          : 'localhost',
      msOffset    : 0,
      lastEventTs : 0,
      customData  : this.clientIdentity,
      protocolVersion : HTTP.CurrentProtocolVersion,
    } as ConnectionInfo

    const provider = new ReplProvider (this.rc, ci, (<any>this.rc).router)

    ci.provider = provider
    
    return ci
  }
}

export class ReplProvider implements XmnProvider {

  private configSent = false
  private requests : { [index: string] : { rejecter: any, resolver: any }}

  constructor(private refRc       : RunContextServer, 
              private ci          : ConnectionInfo, 
              private router      : XmnRouterServer) {
  }

  start(rc: RunContextServer, wo: WireObject) {
    const apiSignature = wo.name + ':' + wo.ts
    if (!this.requests) this.requests = {} 
    return new Promise<{data : any}> ((resolve, reject) => {
      this.requests[apiSignature] = { rejecter: reject, resolver: resolve }
    })
  }

  async routeRequest (rc: RunContextServer, apiName: string, param: object) {
    const  wo = {
            name    : apiName,
            type    : WIRE_TYPE.REQUEST,
            ts      : Date.now(),
            data    : param
          } as WireObject
    try {
      let promise = this.start (rc, wo)
      await this.router.routeRequest(rc, this.ci, wo)
      const res = await promise
      return res
    } catch (err) {
      console.log ('Error routing Request', err)
      //throw e
      return {data : {error :err}}
    }
  }

  async routeEvent (rc: RunContextServer, eventName: string, param: object) : Promise<{data: any}>{
    const wo = {
            name    : eventName,
            type    : WIRE_TYPE.EVENT,
            ts      : Date.now(),
            data    : param
          } as WireObject

    try {
      let promise = this.start (rc, wo)
      await this.router.routeEvent(rc, this.ci, wo)
      const res = await promise
      return res
    } catch (e) {
      console.log ('Error routing event', e)
      throw e
    }
  }

  send(rc: RunContextServer, data: WireObject[]): void {
    rc.isDebug() && rc.debug (rc.getName (this), 'Sending to Client:', data.length, 'messages.')
    data.forEach ((wo, idx) => this.sendOneMessage (rc, wo, idx))

  }

  public requestClose() {

  }

  sendOneMessage (rc: RunContextServer, wo: WireObject, idx: number) : void {
    if (wo.type == WIRE_TYPE.SYS_EVENT && wo.name == 'UPGRADE_CLIENT_IDENTITY') {
      this.ci.customData = wo.data as CustomData
      rc.isStatus() && rc.status (rc.getName (this), 'Updated Client Identity: ', JSON.stringify (this.ci.customData))
      return
    }

    const apiSignature = wo.name + ':' + wo.ts
    if (wo && (<any>wo).error) {
      rc.isDebug() && rc.debug (rc.getName (this), 'Send Error to client: ', wo)
      this.requests[apiSignature].rejecter ((<any>wo)._err)
      delete this.requests[apiSignature]
    }
    else if (!wo.data) {
        rc.isWarn() && rc.warn (rc.getName (this), 'Invalid Response to client: WireObject data is undefined', JSON.stringify (wo))
        this.requests[apiSignature].rejecter ('Invalid Response to client: WireObject data is undefined')
        delete this.requests[apiSignature]
    }
    else {
      rc.isDebug() && rc.debug (rc.getName (this), 'Sending Response to client: ', wo)
      switch (wo.type) {
        case 'REQ_RESP': case 'EVENT_RESP':
          this.requests[apiSignature].resolver(wo)
          delete this.requests[apiSignature]
        case 'EVENT': default:
          break
      }
    }
  } 
}


