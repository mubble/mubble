/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri Apr 14 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as http from 'http'
import {RunContextServer}     from '../rc-server'

export class HttpXmn {

  constructor(private refRc: RunContextServer) {

  }

  requestHandler(req: http.IncomingMessage, res: http.ServerResponse) : void {

    const rc = this.refRc.copyConstruct('', 'HttpReq')

    rc.isDebug() && rc.debug(rc.getName(this), 'http api', req.url)

    res.setHeader('Content-Type', 'text/html');
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('ok');
  }
}