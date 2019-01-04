/*------------------------------------------------------------------------------
   About      : Encryption-decryption provider for server to server comm
   
   Created on : Thu Dec 27 2018
   Author     : Vishal Sinha
   
   Copyright (c) 2018 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import {
         Mubble,
         WireObject,
         HTTP
       }                      from '@mubble/core'
import { SecurityErrorCodes } from './security-errors'
import { UStream }            from '../util'
import { RunContextServer }   from '../rc-server'
import * as crypto            from 'crypto'
import * as zlib              from 'zlib'
import * as stream            from 'stream'

const SYM_ALGO             = 'aes-256-cbc',
      IV                   = new Buffer([ 0x01, 0x00, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00,
                                          0x01, 0x00, 0x09, 0x00, 0x07, 0x00, 0x00, 0x00 ]),
      MIN_SIZE_TO_COMPRESS = 1000,
      BASE64               = 'base64'

export class HttpsEncProvider {

  private symmKey : Buffer
  private headers : Mubble.uObject<any>

  public constructor(private privateKey : string, headers ?: Mubble.uObject<any>) {
    this.headers = headers ? headers : {}
  }

  public encodeSymmKey(publicKey : string) : string {
    if(!this.symmKey) this.setSymmKey()
    const encSymmKey = (crypto.publicEncrypt(publicKey, this.symmKey)).toString(BASE64)

    this.headers[HTTP.HeaderKey.symmKey] = encSymmKey

    return encSymmKey
  }

  public decodeSymmKey(encSymmKey : string = this.headers[HTTP.HeaderKey.symmKey]) : Buffer {
    const encSymmKeyBuf = new Buffer(encSymmKey, BASE64)

    this.symmKey = crypto.privateDecrypt(this.privateKey, encSymmKeyBuf)

    return this.symmKey
  }

  public getHeaders() {
    return this.headers
  }

  public getRequestTs(publicKey : string,
                      encReqTs  : string = this.headers[HTTP.HeaderKey.requestTs]) {
                        
    const requestTs = this.decodeRequestTs(publicKey, encReqTs)

    return requestTs
  }

  public encodeWireObject(rc      : RunContextServer,
                          wo      : WireObject,
                          streams : Array<stream.Writable>) {
                                  
    this.headers[HTTP.HeaderKey.requestTs]   = this.encodeRequestTs(wo.ts)
    this.headers[HTTP.HeaderKey.contentType] = HTTP.HeaderValue.stream
    
    return this.encodeBody(rc, wo.data, streams)
  }

  public async decodeBody(rc       : RunContextServer,
                          streams  : Array<stream.Readable>,
                          encoding : string = this.headers[HTTP.HeaderKey.bodyEncoding]) : Promise<string> {
    
    streams.push(this.getDecipher() as any)

    switch(encoding) {
      case HTTP.HeaderValue.deflate :
        streams.push(zlib.createInflate())
        break

      case HTTP.HeaderValue.gzip :
        streams.push(zlib.createGunzip())
        break

      case HTTP.HeaderValue.identity :
        break

      default :
        throw new Mubble.uError(SecurityErrorCodes.INVALID_ENCODING,
                                'Unknown compression factor.')
    }

    const stream  = new UStream.ReadStreams(rc, streams),
          jsonStr = (await stream.read()).toString()

    return jsonStr
  }

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   PRIVATE METHODS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

  private encodeRequestTs(tsMilli : number) : string {
    const tsMicro  = tsMilli * 1000,
          encReqTs = crypto.privateEncrypt(this.privateKey, new Buffer(tsMicro))

    return encReqTs.toString(BASE64)
  }

  private decodeRequestTs(publicKey : string, encReqTs : string) : number {
    const encReqTsBuf = new Buffer(encReqTs, BASE64),
          reqTsBuf    = crypto.publicDecrypt(publicKey, encReqTsBuf),
          requestTs   = Number(reqTsBuf.toString())

    return requestTs
  }

  private encodeBody(rc      : RunContextServer,
                     json    : Mubble.uObject<any>,
                     streams : Array<stream.Writable>) {

    const jsonStr = JSON.stringify(json)

    streams.unshift(this.getCipher() as any)

    if(jsonStr.length > MIN_SIZE_TO_COMPRESS) {
      this.headers[HTTP.HeaderKey.bodyEncoding]     = HTTP.HeaderValue.deflate
      this.headers[HTTP.HeaderKey.transferEncoding] = HTTP.HeaderValue.chunked
      streams.unshift(zlib.createDeflate())
    } else {
      this.headers[HTTP.HeaderKey.bodyEncoding]  = HTTP.HeaderValue.identity
      this.headers[HTTP.HeaderKey.contentLength] = jsonStr.length
    }

    return {streams, data : jsonStr}
  }

  private setSymmKey(data ?: Buffer) : Buffer {
    this.symmKey = data ? data : crypto.randomBytes(32)

    return this.symmKey
  }

  private getCipher() {
    if(!this.symmKey) this.setSymmKey()

    const cipher = crypto.createCipheriv(SYM_ALGO, this.symmKey, IV)

    return cipher
  }

  private getDecipher() {
    if(!this.symmKey) this.decodeSymmKey()

    const decipher = crypto.createDecipheriv(SYM_ALGO, this.symmKey, IV)

    return decipher
  }


}