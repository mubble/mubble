/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri Apr 14 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as http from 'http'
import {RunContextServer}     from '../rc-server'

export class HttpXmn {

  constructor(private refRc: RunContextServer, private azure: any) {

  }

  requestHandler(req: http.IncomingMessage, res: http.ServerResponse) : void {

    const rc = this.refRc.copyConstruct('', 'HttpReq')
    
    rc.isDebug() && rc.debug(rc.getName(this), 'http api', req.url, 
      req.headers, req.socket ? {localAddr: req.socket.localAddress  + ':' + req.socket.localPort, 
      remote: req.socket.remoteAddress + ':' + req.socket.remotePort } : 'no socket')

    let qs = require('querystring')
    let body = ''
    req.on('data', function(data) {
      body += data
    })
    
    const _ : HttpXmn = this
    req.on('end', function() {
      
      _.processRequest(req.url, body)
      
      res.setHeader('Content-Type', 'text/html');
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('ok');
    })
    
  }

  processRequest(url: string | undefined, body: any) {

    const rc = this.refRc.copyConstruct('', 'HttpReq')
    
    if (url == undefined) {
      rc.isDebug() && rc.debug(rc.getName(this), '!!! url is undefined', url)
      return
    }

    if (url.endsWith('modCallback')) {
      this.azure.callbackHandler(rc, JSON.parse(body))
    } else {
      rc.isDebug() && rc.debug(rc.getName(this), 'unknown url', url)
    }
  }
}
