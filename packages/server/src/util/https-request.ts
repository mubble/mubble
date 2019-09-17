/*------------------------------------------------------------------------------
   About      : Http & Https utils
   
   Created on : Tue May 23 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { 
         HTTP, 
         Mubble
       }                        from '@mubble/core'
import { RunContextServer }     from '../rc-server'
import { UStream }              from './mubble-stream'
import * as https               from 'https'
import * as http                from 'http'
import * as zlib                from 'zlib'
import * as url                 from 'url'
import * as stream              from 'stream'

export async function executeHttpsRequest(rc: RunContextServer, urlStr: string, headers ?: any, encoding ?: string): Promise<string> {
  const traceId = 'executeHttpsRequest',
        ack     = rc.startTraceSpan(traceId)
  try { 
    return await new Promise<string>((resolve, reject) => {
      const urlObj : any = url.parse(urlStr),
            httpObj: any = urlObj.protocol === 'https:' ? https : http
    
      if(headers) urlObj.headers = headers
      const req = httpObj.request(urlObj, (outputStream: any) => {

        outputStream.setEncoding(encoding || 'binary')

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
          resolve(response)
        })
        outputStream.on('error', (err: any) => {
          rc.isStatus() && rc.status(rc.getName(this), `Error : ${err}`)
          reject(response)
        })
      })

      req.shouldKeepAlive = false

      req.on('response', (res: any) => {
        const hostname = url.parse(urlStr).host
        rc.isStatus () && rc.status (rc.getName (this), 'HTTP Response [' + hostname + '], Status Code: ' + res.statusCode, 
          'Content Length:', res.headers['content-length'], '/', res.headers['transfer-encoding'])
      })

      req.on('error', (err: any) => {
        rc.isStatus() && rc.status(rc.getName(this), err)
        if (err.errno && err.errno === 'ENOTFOUND') return resolve(undefined) 
        return reject(err)
      })

      req.end()
    })
  } finally {
    rc.endTraceSpan(traceId,ack)
  }
}

export async function getStream(rc: RunContextServer, urlStr: string, headers ?: any, encoding ?: string): Promise<stream> {
  const traceId = 'executeHttpsRequest',
        ack     = rc.startTraceSpan(traceId)
  try { 
    return await new Promise<stream>((resolve, reject) => {
      const urlObj : any = url.parse(urlStr),
            httpObj: any = urlObj.protocol === 'https:' ? https : http
    
      if(headers) urlObj.headers = headers

      httpObj.request(urlObj, (outputStream : any) => {

        outputStream.setEncoding(encoding || 'binary')

        switch (outputStream.headers['content-encoding']) {
        case 'gzip':
          outputStream = outputStream.pipe(zlib.createGunzip())
          break
        case 'deflate':
          outputStream = outputStream.pipe(zlib.createInflate())
          break
        }

        resolve(outputStream)
      })
      .on('response', (res: any) => {
        const hostname = url.parse(urlStr).host
        rc.isStatus () && rc.status (rc.getName (this), 'HTTP Response [' + hostname + '], Status Code: ' + res.statusCode, 
          'Content Length:', res.headers['content-length'], '/', res.headers['transfer-encoding'])
      })
      .on('error', (err: any) => {
        rc.isStatus() && rc.status(rc.getName(this), err)
        if(err.errno && err.errno === 'ENOTFOUND') return resolve(undefined) 
        return reject(err)
      })
      .end()
    })
  } finally {
    rc.endTraceSpan(traceId,ack)
  }
}

export async function executeHttpsWithOptions(rc: RunContextServer, urlObj: any, inputData ?: string): Promise<string> {
  const traceId = 'executeHttpsWithOptions',
        ack     = rc.startTraceSpan(traceId)
  
  if(!urlObj.headers) urlObj.headers = {}

  try {
    return await new Promise<string>((resolve, reject) => {
      const httpObj    : any    = (urlObj.protocol === 'https:' || urlObj.port === '443') ? https : http
      
      if(inputData && !urlObj.headers['Content-Length'])
        urlObj.headers['Content-Length'] = Buffer.byteLength(inputData, 'utf8')
        
      if(httpObj === https)
        urlObj.agent = new https.Agent({keepAlive: true})

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
        outputStream.on('error', (err: any) => {
          rc.isStatus() && rc.status(rc.getName(this), `Error : ${err}`)
          return reject(response)
        })
      })

      req.shouldKeepAlive = false

      req.on('response', (res: any) => {
        rc.isStatus () && rc.status(rc.getName (this), 'HTTP Response [' + urlObj.host + '], Status Code: ' + res.statusCode)
      })
      req.on('error', (err: any) => {
        rc.isStatus() && rc.status(rc.getName(this), err)
        if (err.errno && err.errno === 'ENOTFOUND') return resolve (undefined) 
        return reject(err)
      })
      if(inputData) req.write(inputData)
      req.end()
    })
  } finally {
    rc.endTraceSpan(traceId, ack)
  }
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
export async function executeHttpResultResponse(rc: RunContextServer, options: http.RequestOptions, 
    inputData ?: string , encoding ?: string ): Promise<{error : string | undefined, response: any, data : string}> {

  if(!options.headers) options.headers = {}

  let response: any
  if(inputData && options.headers && !options.headers['Content-Length']) 
      options.headers['Content-Length'] = Buffer.byteLength(inputData , 'utf-8')

  const traceId = 'executeHttpResultResponse',
        ack     = rc.startTraceSpan(traceId)
        
  try {  
    return await new Promise<{error: string | undefined, response: any, data : string}>((resolve, reject) => {
      const httpObj : any = options.protocol === 'http:' ? http : https

      const req = httpObj.request(options, (outputStream: any) => {

        switch (outputStream.headers['content-encoding']) {
          case 'gzip':
            outputStream = outputStream.pipe(zlib.createGunzip())
            break
          case 'deflate':
            outputStream = outputStream.pipe(zlib.createInflate())
            break
        }
        
        let data : Buffer
        outputStream.on('data', (chunk: Buffer) => {
          if(!data) data = chunk
          else      data = Buffer.concat([data , chunk])
        })
        outputStream.on('end', () => {
          // If encoding is not defined . default is utf8
          return resolve({error: undefined, response: response, data: data.toString(encoding)})
        })
        outputStream.on('error', (err: any) => {
          rc.isStatus() && rc.status(rc.getName(this), `Error : ${err}`)
          return reject(response)
        })
      })

      req.shouldKeepAlive = false

      req.on('response', (res: any) => {
        response = res
      })

      req.on('error', (err: any) => {
        rc.isStatus() && rc.status(rc.getName(this), err)
        return resolve({error: err, response: response, data: ''})
      })

      if(inputData) req.write(inputData)
      req.end()
    })
  } finally {
    rc.endTraceSpan(traceId, ack)
  }
}

/**
 * http(s) request for passing http options along with url.
 * To pass query params, pass in urlObj.query.
 * To pass JSON, pass in data as JSON string.
 */
export async function executeHttpsRequestWithOptions(rc       : RunContextServer,
                                                     urlObj   : url.UrlObject,
                                                     options ?: http.RequestOptions,
                                                     data    ?: string) : Promise<string>{

  rc.isDebug() && rc.debug(rc.getName(this), 'executeHttpsRequestWithOptions', urlObj, options, data)

  const reqOptions : http.RequestOptions = options ? options : urlObj

  if(!reqOptions.headers) reqOptions.headers = {}
  if(data && !reqOptions.headers[HTTP.HeaderKey.contentLength]) {
    reqOptions.headers[HTTP.HeaderKey.contentLength] = data.length
  }

  const urlStr = url.format(urlObj)

  rc.isStatus() && rc.status(rc.getName(this), 'http(s) request.', urlStr, reqOptions)

  const req          = reqOptions.protocol === HTTP.Const.protocolHttp ? http.request(urlStr, reqOptions)
                                                                       : https.request(urlStr, reqOptions),
        writePromise = new Mubble.uPromise(),
        readPromise  = new Mubble.uPromise(),
        writeStreams = [] as Array<stream.Writable>,
        readStreams  = [] as Array<stream.Readable>

  writeStreams.push(req)

  req.on('response', (res : http.IncomingMessage) => {

    rc.isDebug() && rc.debug(rc.getName(this), 'Response headers.', urlStr, res.headers)

    readStreams.push(res)

    if(res.headers[HTTP.HeaderKey.contentEncoding]) {
      switch(res.headers[HTTP.HeaderKey.contentEncoding]) {
        case HTTP.HeaderValue.gzip :
          readStreams.push(zlib.createGunzip())
          break
        case HTTP.HeaderValue.deflate :
          readStreams.push(zlib.createInflate())
          break
      }
    }

    const readUStream = new UStream.ReadStreams(rc, readStreams, readPromise)
    readUStream.read()
  })

  req.on('error', (err : Error) => {
    rc.isError() && rc.error(rc.getName(this), 'Error encountered in http(s) request.', err)
    writePromise.reject(err)
    readPromise.reject(err)
  })

  const writeUStream = new UStream.WriteStreams(rc, writeStreams, writePromise)
  data ? writeUStream.write(data) : writeUStream.write('')

  const [, output] : Array<any> = await Promise.all([writePromise.promise, readPromise.promise])

  rc.isStatus() && rc.status(rc.getName(this), 'http(s) request response.', urlStr, output.toString())

  return output.toString()
}

// example
async function testHttpRequest(rc : RunContextServer) {

  const urlObj : url.UrlObject = {
    protocol : HTTP.Const.protocolHttp,
    hostname : 'localhost',
    port     : 9003,
    pathname : '/obopay/serverEcho',
    query    : { abc : 124, b : 'abc' }
  }

  const options : http.RequestOptions = urlObj
  options.method  = HTTP.Method.POST
  options.headers = {[HTTP.HeaderKey.contentType] : HTTP.HeaderValue.form}

  const resp = await executeHttpsRequestWithOptions(rc, urlObj, options)

  rc.isStatus() && rc.status(rc.getName(this), 'response', resp)
}