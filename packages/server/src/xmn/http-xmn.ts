/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri Apr 14 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as http from 'http'

export class HttpXmn {

  requestHandler(req: http.IncomingMessage, res: http.ServerResponse) : void {
    res.setHeader('Content-Type', 'text/html');
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('ok');
  }
}