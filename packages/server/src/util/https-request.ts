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
import {RunContextServer}    from '../rc-server'

export function executeHttpsRequest(rc: RunContextServer, urlStr: string): Promise<string> {

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

      req.on('response', (res: any) => {
        if (res.statusCode != 200) {
          return resolve(undefined)
        }
      })
      req.on('error', (err: any) => {
        rc.isStatus() && rc.status (err)
        if (err.errno && err.errno === 'ENOTFOUND') return resolve (undefined) 
        return reject(err)
      })
      req.end()
    })
  }

  export function executeHttpsWithOptions(rc: RunContextServer, urlObj: any, inputData ?: string): Promise<string> {

    return new Promise((resolve, reject) => {
      const httpObj    : any    = urlObj.protocol === 'http:' ? http : https
      let   statusCode : number = 200
      
      if(inputData && !urlObj.headers['Content-Length']) 
        urlObj.headers['Content-Length'] = new Buffer(inputData).length
        
      const req = httpObj.request(urlObj, (outputStream: any) => {

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

      req.on('response', (res: any) => {
        rc.isStatus () && rc.status (rc.getName (this), 'HTTP Response, Status Code: ' + res.statusCode)
        statusCode = res.statusCode
      })
      req.on('error', (err: any) => {
        rc.isStatus() && rc.status (err)
        if (err.errno && err.errno === 'ENOTFOUND') return resolve (undefined) 
        return reject(err)
      })
      if(inputData) req.write(inputData)
      req.end()
    })
  }

  /**
   * This is recommended to be used for https request.
   * returns {error: string | undefined, statusCode: number | undefined, data: any}
   * 
   * Caller has to process this result as per their need
   * 
   * Execute http and return result data as well as response code.
   * Drupal SEO server data sync request fails with # 200 status code and error msg
   */ 
  export function executeHttpResultResponse(rc: RunContextServer, urlObj: any, 
      inputData ?: string): Promise<{error : string | undefined, response: any, data : string}> {

    let response: any
    
    return new Promise<{error: string | undefined, response: any, data : string}>((resolve, reject) => {
      const httpObj: any = urlObj.protocol === 'http:' ? http : https
      const req = httpObj.request(urlObj, (outputStream: any) => {

        switch (outputStream.headers['content-encoding']) {
        case 'gzip':
          outputStream = outputStream.pipe(zlib.createGunzip())
          break
        case 'deflate':
          outputStream = outputStream.pipe(zlib.createInflate())
          break
        }

        let data = ''
        outputStream.on('data', (chunk: any) => {
          data += chunk
        })
        outputStream.on('end', () => {
          return resolve({error: undefined, response: response, data: data})
        })
      })

      req.on('response', (res: any) => {
        response = res
      })

      req.on('error', (err: any) => {
        rc.isStatus() && rc.status (err)
        return resolve({error: err, response: response, data: ''})
      })

      if(inputData) req.write(inputData)
      req.end()
    })
  }