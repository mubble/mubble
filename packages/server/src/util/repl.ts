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

      Object.assign(this.replServer.context, context)
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

class ReplProvider {

  private configSent = false
  private resolver    : any
  private rejecter    : any

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
    let promise = this.start (rc)
    await this.router.routeRequest(rc, this.ci, wo)
    const res = await promise
    return res
  }

  async routeEvent (rc: RunContextServer, eventName: string, param: object) {
    const wo = {
            name    : eventName,
            type    : WIRE_TYPE.EVENT,
            ts      : Date.now(),
            data    : param
          } as WireObject

    let promise = this.start (rc)
    await this.router.routeRequest(rc, this.ci, wo)
    const res = await promise
    return res
  }

  send(rc: RunContextServer, data: WireObject): void {
    if (data.type == WIRE_TYPE.SYS_EVENT && data.name == "UPGRADE_CLIENT_IDENTITY") {
      this.ci.clientIdentity = data.data as ClientIdentity
      rc.status (rc.getName (this), 'Updated Client Identity: ', JSON.stringify (this.ci.clientIdentity))
      return
    }
    if (data && (<any>data).error) {
      rc.debug (rc.getName (this), 'Send Error to client: ', data)
      this.rejecter ((<any>data).error)
    }
    else {
      rc.debug (rc.getName (this), 'Sending Response to client: ', data)
      this.resolver (data)
    }
  }  
}
