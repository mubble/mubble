/*------------------------------------------------------------------------------
   About      : New wss server
   
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
import * as ws                from 'ws'
import * as https             from 'https'
import * as http 							from 'http'

export class WssServer {

  private server : ws.Server

  constructor(private refRc  : RunContextServer,
              private router : XmnRouterServer,
              httpServer     : https.Server) {

		this.server = new ws.Server({
			server : httpServer
		})

		this.server.on('connection', this.establishHandshake.bind(this))
	}
	
	private establishHandshake(socket : WebSocket, req : http.IncomingMessage) {

    

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