/*------------------------------------------------------------------------------
   About      : Websocket based request handler
   
   Created on : Fri Jan 04 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import {
         WireObject,
         XmnProvider
       }                      from '@mubble/core'
import { RunContextServer }   from '../rc-server'
import { XmnRouterServer } 		from './xmn-router-server'
import { ObopayWssClient }    from './obopay-wss-client'
import * as ws                from 'ws'
import * as https             from 'https'
import * as http 							from 'http'
import * as urlModule         from 'url'

const SLASH_SEP = '/'

export class WssServer {

  private server : ws.Server

  constructor(private refRc  : RunContextServer,
              private router : XmnRouterServer,
              httpsServer    : https.Server) {

		this.server = new ws.Server({
			server : httpsServer
		})

		this.server.on('connection', this.establishHandshake.bind(this))
	}
	
	private establishHandshake(socket : WebSocket, req : http.IncomingMessage) {

    const rc = this.refRc.copyConstruct(undefined, 'handshake') as RunContextServer

    rc.isStatus() && rc.status(rc.getName(this), 'Recieved a new connection. Establishing handshake.')

    try {
      if(!req.url) throw new Error('Request URL absent.')

      const url  = urlModule.parse(req.url),
            path = url.pathname || ''

      const [, version, clientId, encData] = path.split(SLASH_SEP)

      if(!version || !clientId || !encData) throw new Error(`Invalid URL path ${path}.`)

      ObopayWssClient.verifyClientRequest(rc, version, clientId)

            
    } catch(err) {
      rc.isError() && rc.error(rc.getName(this), 'Error in establishing handshake.', err)
      socket.close()
    }
	}
}

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   Wss Server Provider
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

export class WssServerProvider implements XmnProvider {
  public constructor() {

  }

  public send() {

  }

  public requestClose() {
    
  }
}