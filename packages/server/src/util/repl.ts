/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri Apr 14 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as repl                    from 'repl'
import * as path                    from 'path'
import * as fs                      from 'fs'
import { 
        ConnectionInfo,
        WireObject,
        Protocol,
        ClientIdentity,
        WIRE_TYPE,
        NetworkType
       }                            from '@mubble/core'
import {
        RunContextServer,
        RUN_MODE
       }                            from '../rc-server'
import {XmnRouterServer}            from '../xmn/xmn-router-server'


// Import from external modules without types
const replHistory: any = require('repl.history') // https://github.com/ohmu/node-posix


export abstract class Repl {
  
  protected ci : ConnectionInfo
  protected replServer : any

  constructor(protected rc: RunContextServer, private clientIdentity: ClientIdentity) {
    this.ci = this.getConnectionInfo ()
  }

  abstract async callApi(apiName: string, param: object) : Promise<void>

  init(context ?: any) {

    return new Promise((resolve, reject) => {
      
      if (!context) context = {}

      context.fs       = fs
      context.path     = path
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

  getConnectionInfo() {
    const ci = {
      protocol        : Protocol.WEBSOCKET,
      host            : 'localhost',        // host name of the server
      port            : 1234,               // port of the server
      url             : '/api/DummyApi',    // /api/getTopics Or connectUrl (for WS)
      headers         : {},                 // empty for client
      ip              : 'localhost',        // ip address or host name of the client socket

      // Information passed by the client: to be used by Xmn internally
      publicRequest   : false,
      msOffset        : 0,                  // this is inferred by the server based on client's now field. Api/event need not use this

      // Information passed by the client used by   
      location        : '{}',
      networkType     : NetworkType.net4G,
      clientIdentity  : this.clientIdentity,

      // provider for this connection (WebSocket, Http etc.)
      provider        : null
      
    } as ConnectionInfo
    ci.provider = new ReplProvider (this.rc, ci, (<any>this.rc).router)
    return ci
  }
}

export class ReplProvider {

  // NOTE: Only a single API at any time. As only one resolver/rejecter is stored.
  private configSent = false
  private resolver    : any
  private rejecter    : any
  private currWR      : WireObject
  private currWE      : WireObject

  constructor(private refRc       : RunContextServer, 
              private ci          : ConnectionInfo, 
              private router      : XmnRouterServer) {
  }

  start(rc: RunContextServer) {
    return new Promise ((resolve, reject) => {
      this.resolver = resolve
      this.rejecter = reject
    })
  }

  async routeRequest (rc: RunContextServer, apiName: string, param: object) {
    const  wo = {
            name    : apiName,
            type    : WIRE_TYPE.REQUEST,
            ts      : Date.now(),
            data    : param
          } as WireObject
    this.currWR = wo
    try {
      let promise = this.start (rc)
      await this.router.routeRequest(rc, this.ci, wo)
      const res = await promise
      return res
    } catch (e) {
      console.log ('Error routing R', e)
      throw e
    }
  }

  async routeEvent (rc: RunContextServer, eventName: string, param: object) {
    const wo = {
            name    : eventName,
            type    : WIRE_TYPE.EVENT,
            ts      : Date.now(),
            data    : param
          } as WireObject

    this.currWE = wo

    try {
      let promise = this.start (rc)
      await this.router.routeEvent(rc, this.ci, wo)
      const res = await promise
      return res
    } catch (e) {
      console.log ('Error routing event', e)
      throw e
    }
  }

  send(rc: RunContextServer, wo: WireObject): void {
    if (wo.type == WIRE_TYPE.SYS_EVENT && wo.name == 'UPGRADE_CLIENT_IDENTITY') {
      this.ci.clientIdentity = wo.data as ClientIdentity
      rc.isStatus() && rc.status (rc.getName (this), 'Updated Client Identity: ', JSON.stringify (this.ci.clientIdentity))
      return
    }

    if (wo && (<any>wo).error) {
      rc.isDebug() && rc.debug (rc.getName (this), 'Send Error to client: ', wo)
      this.rejecter ((<any>wo).error)
    }
    else if (!wo.data) {
        rc.isWarn() && rc.warn (rc.getName (this), 'Invalid Response to client: WireOBject data is undefined')
        this.rejecter ('Invalid Response to client: WireObject data is undefined')
    }
    else {
      const res = wo.type === 'EVENT_RESP' ? this.check(this.currWE, wo) : this.check(this.currWR, wo)
      if (res) return
      rc.isDebug() && rc.debug (rc.getName (this), 'Sending Response to client: ', wo)
      this.resolver (wo)
    }
  } 

  check(reqwo: WireObject, reswo: WireObject) {
    if (reqwo.name !== reswo.name && reqwo.ts !== reswo.ts) return true
    return false
  }
}


