/*------------------------------------------------------------------------------
   About      : Execute an https request
   
   Created on : Tue May 23 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as https            from 'https'
import * as http             from 'http'
import * as zlib             from 'zlib'
import * as url              from 'url'

export function executeHttpsRequest(urlStr: string): Promise<string> {

    return new Promise((resolve, reject) => {

      const urlObj  = url.parse(urlStr),
            httpObj: any = urlObj.protocol === 'http:' ? http : https

      const req = httpObj.request(urlObj, (outputStream: any) => {

        outputStream.setEncoding('binary')

        switch (outputStream.headers['content-encoding']) {
        case 'gzip':
          outputStream = outputStream.pipe(zlib.createGunzip())
          break
        case 'deflate':
          outputStream = outputStream.pipe(zlib.createInflate())
          break
        }

        let response = ''
        outputStream.on('data', (chunk: any) => {
          response += chunk
        })
        outputStream.on('end', () => {
          return resolve(response)
        })
      })

      req.on('error', (err: any) => {
        return reject(err)
      })
      req.end()
    })
  }