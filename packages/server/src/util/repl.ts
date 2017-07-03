/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri Apr 14 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as repl                    from 'repl'
import * as path                    from 'path'
import * as fs                      from 'fs'
import { ConnectionInfo, WireObject, Protocol, ClientIdentity, WIRE_TYPE } 
                                    from '@mubble/core'
import { XmnRouterServer }          from '@mubble/server'

import {RunContextServer, RUN_MODE} from '../rc-server'

// Import from external modules without types
const replHistory: any = require('repl.history') // https://github.com/ohmu/node-posix


export class Repl {
  
  promise: Promise<any>
  protected ci : ConnectionInfo

  constructor(protected rc: RunContextServer) {
    this.ci = this.getConnectionInfo ()
  }

  init(context ?: any) {

    return new Promise((resolve, reject) => {
      
      if (!context) context = {}

      context.fs       = fs
      context.path     = path
      context.$        = this
      context.rc       = this.rc
      context.ci       = this.getConnectionInfo ()

      const replServer: any = repl.start({prompt: 'mubble > ', useGlobal: true})
      replHistory(replServer, process.env.HOME + '/.mubble-repl')

      Object.assign(replServer.context, context)
      replServer.on('exit', function () {
        resolve()
      })

      replServer.on('error', (err: Error) => {
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
    const rc  : any = this.rc,
          ci = {
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
      location        : {},
      networkType     : '4G',
      clientIdentity  : {
        appName       : 'NCAPP',
        channel       : 'ANDROID',
        appVersion    : '0.9.0',
        jsVersion     : '0.2.0'

        // only available when client is issued an identity
        //clientId      : number
        //userLinkId    : string
        //userName      : string
      } as ClientIdentity,

      // provider for this connection (WebSocket, Http etc.)
      provider        : null
      
    } as ConnectionInfo
    ci.provider = new ReplProvider (this.rc, ci, (<any>this.rc).router)
    return ci
  }

  callApi(apiName: string, param: object) {
    const rc  : any = this.rc, // TODO: Why does RunContextServer not have router?
          ci        = this.ci,
          wo = {
            name    : apiName,
            type    : WIRE_TYPE.REQUEST, // TODO: Need to be event or request...
            ts      : Date.now(),
            data    : param
          } as WireObject
    ci.url    = '/api/' + apiName,
    rc.router.verifyConnection (rc, ci)
    return rc.router.routeRequest(rc, ci, wo)
    // TODO: Need to call rc.router.connectionClosed (rc, ci)
  }
}

class ReplProvider {

  private configSent = false

  constructor(private refRc       : RunContextServer, 
              private ci          : ConnectionInfo, 
              private router      : XmnRouterServer) {
  }

  send(rc: RunContextServer, data: WireObject): void {
    if (data.type == WIRE_TYPE.SYS_EVENT && data.name == "UPGRADE_CLIENT_IDENTITY") {
      this.ci.clientIdentity = data.data as ClientIdentity
      rc.status (rc.getName (this), 'Updated Client Identity: ', JSON.stringify (this.ci.clientIdentity))
      return
    }
    rc.status (rc.getName (this), 'Response: ', JSON.stringify (data))
  }  
}
