/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri Jan 05 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import * as https            from 'https'
import * as http             from 'http'
import * as requestModule    from 'request'

import * as zlib             from 'zlib'
import * as urlModule        from 'url'
import * as path             from 'path'

import * as qs               from 'querystring'
import * as mime             from 'mime-types'
import * as stream           from 'stream'
import * as fs               from 'fs'

import { Mubble, 
         HTTP }              from '@mubble/core'
import { RunContextServer }  from '../rc-server'
import { UStream }           from '../util/mubble-stream'

export namespace MubbleHttpClient {

  let selfFQDN: string
  let credentialRegistry: CredentialRegistry

  export type MubbleCredential = {
    id                : string // typically fqdn of client
    clientSecret      : string // base64 encoded secret of the client
    serverCertificate : string
  }

  export interface CredentialRegistry {
    getCredential(fqdn: string): MubbleCredential
  }

  // Set the domain name of the server. It is used as user agent name
  // Credential Registry provides secret for each clients fqdn, typically kept in master
  export function init(rc: RunContextServer, selfFullyQualifiedDomainName: string, registry: CredentialRegistry) {
    rc.isAssert() && rc.assert(rc.getName(this), !selfFQDN, 'calling twice?')

    selfFQDN            = selfFullyQualifiedDomainName
    credentialRegistry  = registry
  }

  export async function mubbleApi(rc: RunContextServer, apiName: string, params: Mubble.uObject<any>, 
                                  host: string, port = 443, certFullPath = '',
                                  resultType: ResultType = ResultType.basic) {

    rc.isAssert() && rc.assert(rc.getName(this), selfFQDN && credentialRegistry)

    const certificate = certFullPath ? fs.readFileSync(certFullPath).toString() : 
                                       credentialRegistry.getCredential(host).serverCertificate,
          secret      = credentialRegistry.getCredential(host).clientSecret                    

    const options: https.RequestOptions = { host, port,
            method    : 'POST',
            path      : `/${qs.escape(apiName)}`,
            ca        : certificate,
            headers   : {
              [HTTP.HeaderKey.userAgent]    : selfFQDN,
              [HTTP.HeaderKey.clientSecret] : secret
            }
          }
    return await request(rc, options, params, resultType)
  }

  export enum ResultType {
    basic,    // default (only returns the output data)
    stream,   // Returns the output stream (without )
    complete  // Returns complete ResultStruct with 'output'
  }

  // Whenever there is failure or ResultType.complete
  export class ResultStruct {
    headers : Mubble.uObject<any>
    status  : number
    output  : Buffer | string | Mubble.uObject<any> | stream.Readable
    error   : null | Error = null
  }

  // This will work for small / medium size data. Large data cannot be sent like this            
  export async function request(rc          : RunContextServer, 
                                urlOptions  : string | https.RequestOptions, 
                                postData   ?: Buffer | string | Mubble.uObject<any>, 
                                resultType  : ResultType = ResultType.basic) {

    const options       = typeof(urlOptions) === 'string' ? getOptionsFromUrl(urlOptions) : urlOptions,
          headers       = options.headers || (options.headers = {}),
          data          = postData ? setContentType(postData, headers) : '',
          method        = options.method || (options.method = postData ? 'POST' : 'GET'),
          req           = options.protocol === HTTP.Const.protocolHttp ? 
                          http.request(options) : https.request(options),
          writePromise  = new Mubble.uPromise(), 
          readPromise   = new Mubble.uPromise(),
          resultStruct  = new ResultStruct()

    req.on('response', (resp: http.IncomingMessage) => {

      resultStruct.status  = resp.statusCode || 200
      resultStruct.headers = resp.headers

      const readStreams     = [resp],
            contentEncoding = resp.headers[HTTP.HeaderKey.contentEncoding],
            contentType     = resp.headers[HTTP.HeaderKey.contentType] as string

      if (contentEncoding === HTTP.HeaderValue.gzip) readStreams.push(zlib.createGunzip() as any)
      else if (contentEncoding === HTTP.HeaderValue.deflate) readStreams.push(zlib.createInflate() as any)

      const format = mime.extension(contentType) === 'json' ? UStream.Encoding.json : 
                     (mime.charset(contentType) === 'UTF-8' ? UStream.Encoding.text : UStream.Encoding.bin)

      rc.isDebug() && rc.debug(rc.getName(this), 'req:response', {
        path          : options.path, 
        status        : resp.statusCode, 
        contentLength : resp.headers[HTTP.HeaderKey.contentLength], 
        contentType, contentEncoding, format
      })

      if (resultType === ResultType.stream) {
        readPromise.resolve(readStreams.length === 1 ? resp : resp.pipe(readStreams[1] as any))
      } else {
        new UStream.ReadStreams(rc, readStreams, readPromise).read(format)
      }
    })

    req.on('error', (err) => {
      writePromise.reject(err)
      readPromise.reject(err)
    })

    headers[HTTP.HeaderKey.userAgent] = headers[HTTP.HeaderKey.userAgent] || selfFQDN
    new UStream.WriteStreams(rc, [req], writePromise).write(data) 

    try {
      const [_, output] = await Promise.all([writePromise.promise, readPromise.promise])
      resultStruct.output = output
    } catch (err) {
      resultStruct.error = err
    }

    if (resultStruct.status === 200) return (resultType === ResultType.complete ? resultStruct : resultStruct.output)
    throw(resultStruct)
  }

  export async function expandUrl(rc: RunContextServer, url: string) {

    const uPromise = new Mubble.uPromise()
    requestModule({ method: 'HEAD', url, followAllRedirects : true}, 
      (err : any, response : any) => {
        if (err) return uPromise.reject(err)
        return response && response.request && response.request.href ?
          uPromise.resolve(response.request.href) :
          uPromise.reject(new Error('invalid response ' + JSON.stringify(response.request)))
      }
    )
    return await uPromise.promise
  }

  function getOptionsFromUrl(url: string) {
    const urlObj = urlModule.parse(url), 
          options: https.RequestOptions = {}
    Object.assign(options, urlObj)
    return options
  }

  function setContentType(postData : Buffer | string | Mubble.uObject<any>, 
                          headers: Mubble.uObject<any>): string | Buffer {

    let data: Buffer | string = ''
    if (headers[HTTP.HeaderKey.contentType]) {
      data = postData as string
    } else if (typeof(postData) === 'string') {
      headers[HTTP.HeaderKey.contentType] = mime.contentType('text') as string
      data = postData as string
    } else if (postData instanceof Buffer) {
      headers[HTTP.HeaderKey.contentType] = mime.contentType('bin') as string
      data = postData as Buffer
    } else {
      headers[HTTP.HeaderKey.contentType] = mime.contentType('json') as string
      data = JSON.stringify(postData)
    }

    if (!headers[HTTP.HeaderKey.contentLength]) {
      headers[HTTP.HeaderKey.contentLength] = Buffer.byteLength(data as string)
    }
    return data
  }
}

