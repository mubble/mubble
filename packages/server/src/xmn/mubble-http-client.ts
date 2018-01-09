/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri Jan 05 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import * as https            from 'https'
import * as http             from 'http'
import * as zlib             from 'zlib'
import * as url              from 'url'
import * as path             from 'path'
import * as fs               from 'fs'
import * as qs               from 'querystring'
import * as mime             from 'mime-types'
import * as request          from 'request'
import { RunContextServer }  from '../rc-server'
import { UStream }           from '../util/mubble-stream'
import * as stream           from 'stream'
import { Mubble, 
         HTTP }              from '@mubble/core'
import { Duplex }            from 'stream';
import { IncomingMessage }   from 'http';
import { debug } from 'util';

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
                                  host: string, port = 443, certFullPath = '') {

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
    return await request(rc, options, params)
  }

  export async function requestByUrl(rc: RunContextServer, urlString: string, postData: string) {

    rc.isAssert() && rc.assert(rc.getName(this), url)

    const urlObj = url.parse(urlString),
          options: https.RequestOptions = { 
            host      : urlObj.host, 
            port      : Number(urlObj.port),
            method    : postData ? 'POST' : 'GET',
            path      : urlObj.path
          }
    return await request(rc, options, postData)
  }

  // This will work for small / medium size data. Large data cannot be sent like this            
  export async function request(rc: RunContextServer, options: https.RequestOptions, 
                                inData ?: Buffer | string | Mubble.uObject<any>) {

    const headers = options.headers || (options.headers = {})
    let data: string | Buffer = ''
    
    headers[HTTP.HeaderKey.userAgent] = headers[HTTP.HeaderKey.userAgent] || selfFQDN

    if (inData && !headers[HTTP.HeaderKey.contentType]) {
      if (typeof(inData) === 'string') {
        headers[HTTP.HeaderKey.contentType] = mime.contentType('text') as string
        data = inData as string
      } else if (inData instanceof Buffer) {
        headers[HTTP.HeaderKey.contentType] = mime.contentType('bin') as string
        data = inData as Buffer
      } else {
        headers[HTTP.HeaderKey.contentType] = mime.contentType('json') as string
        data = JSON.stringify(inData)
      }
    }

    if (data) headers[HTTP.HeaderKey.contentLength] = Buffer.byteLength(data as string)

    const req           = options.protocol === HTTP.Const.protocolHttp ? 
                          http.request(options) : https.request(options),
          writePromise  = new Mubble.uPromise(), 
          readPromise   = new Mubble.uPromise()

    req.on('response', (resp: IncomingMessage) => {

      const readStreams     = [resp],
            contentEncoding = resp.headers[HTTP.HeaderKey.contentEncoding],
            contentType     = resp.headers[HTTP.HeaderKey.contentType],
            contentLength   = resp.headers[HTTP.HeaderKey.contentLength],
            extension       = mime.extension(contentType as string),
            charset         = mime.charset(contentType as string)

      if (contentEncoding === HTTP.HeaderValue.gzip) readStreams.push(zlib.createGunzip() as any)
      else if (contentEncoding === HTTP.HeaderValue.deflate) readStreams.push(zlib.createInflate() as any)

      const format = extension === 'json' ? UStream.Encoding.json : 
                     (charset === 'UTF-8' ? UStream.Encoding.text : UStream.Encoding.bin)

      rc.isDebug() && rc.debug(rc.getName(this), 'req:response', {path: options.path, status: resp.statusCode, 
        contentLength, contentType, contentEncoding, format})

      new UStream.ReadStreams(rc, readStreams, readPromise).read(format)
    })

    new UStream.WriteStreams(rc, [req], writePromise).write(data as string)
    const [_, result] = await Promise.all([writePromise.promise, readPromise.promise])
    return result
  }
}

