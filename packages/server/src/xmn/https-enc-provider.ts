/*------------------------------------------------------------------------------
   About      : Encryption-decryption provider for https server
   
   Created on : Thu Dec 27 2018
   Author     : Vishal Sinha
   
   Copyright (c) 2018 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import {
         Mubble,
         HTTP
       }                      from '@mubble/core'
import { SecurityErrorCodes } from './security-errors'
import * as crypto            from 'crypto'
import * as zlib              from 'zlib'
import * as stream            from 'stream'

const SYM_ALGO                = 'aes-256-cbc',
      IV                      = Buffer.from([ 0x01, 0x00, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00,
                                              0x01, 0x00, 0x09, 0x00, 0x07, 0x00, 0x00, 0x00 ]),
      MIN_SIZE_TO_COMPRESS    = 1000,
      BASE64                  = 'base64',
      SIXTEEN                 = 16

export class HttpsEncProvider {

  private reqAesKey  : Buffer
  private respAesKey : Buffer
  private privateKey : string

  public constructor(pk : string) {
    this.privateKey = pk
  }

  public encodeRequestKey(publicKey : string) : string {
    if(!this.reqAesKey) this.setReqAesKey()

    const encKeyBuf = (crypto.publicEncrypt(publicKey, this.reqAesKey)),
          encKey    = encKeyBuf.toString(BASE64)

    return encKey
  }

  public decodeRequestKey(encKey : string) : Buffer {
    const encKeyBuf = Buffer.from(encKey, BASE64)

    this.reqAesKey = crypto.privateDecrypt(this.privateKey, encKeyBuf)

    return this.reqAesKey
  }

  public encodeRequestTs(ts : number) : string {
    const encReqTs = this.encryptRequestTs(ts)

    return encReqTs
  }

  public decodeRequestTs(publicKey : string, encReqTs  : string) {
    const requestTs = this.decryptRequestTs(publicKey, encReqTs)

    return requestTs
  }

  public encodeBody(data     : Mubble.uObject<any>,
                    response : boolean) : {
                                            streams        : Array<stream.Writable>,
                                            dataStr        : string,
                                            bodyEncoding   : string,
                                            contentLength ?: number
                                          } {

    return this.encryptBody(data, response)
  }

  public decodeBody(streams  : Array<stream.Readable>,
                    encoding : string,
                    response : boolean) : Array<stream.Readable> {
    
    const key = response ? this.reqAesKey : this.reqAesKey

    streams.push(this.getDecipher(key) as any)

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

    return streams
  }

  public decodeResponseKey(publicKey : string, encKey : string) : Buffer {
    const encKeyBuf = Buffer.from(encKey, BASE64),
          decKey    = crypto.publicDecrypt(publicKey, encKeyBuf)

    this.respAesKey = this.decryptUsingReqAesKey(decKey)

    return this.respAesKey
  }

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   PRIVATE METHODS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

  private encryptRequestTs(tsMilli : number) : string {
    const tsMicro  = tsMilli * 1000,
          encReqTs = crypto.privateEncrypt(this.privateKey, new Buffer(tsMicro.toString()))

    return encReqTs.toString(BASE64)
  }

  private decryptRequestTs(publicKey : string, encReqTs : string) : number {
    const encReqTsBuf = new Buffer(encReqTs, BASE64),
          reqTsBuf    = crypto.publicDecrypt(publicKey, encReqTsBuf),
          requestTs   = Number(reqTsBuf.toString())

    return requestTs
  }

  private encryptBody(json     : Mubble.uObject<any>,
                      response : boolean) : {
                                              streams        : Array<stream.Writable>,
                                              dataStr        : string,
                                              bodyEncoding   : string,
                                              contentLength ?: number
                                            } {

    const jsonStr = JSON.stringify(json),
          streams = [] as Array<stream.Writable>

    let bodyEncoding  : string             = HTTP.HeaderValue.identity,
        contentLength : number | undefined

    if(jsonStr.length > MIN_SIZE_TO_COMPRESS) {
      bodyEncoding = HTTP.HeaderValue.deflate
      streams.push(zlib.createDeflate())
    } else {
      contentLength = this.getFinalContentLength(jsonStr.length)
    }

    if(!this.reqAesKey) this.setReqAesKey()
    const key = response ? this.respAesKey : this.reqAesKey

    streams.push(this.getCipher(key) as any)

    return {streams, dataStr : jsonStr, bodyEncoding, contentLength}
  }

  private setReqAesKey(data ?: Buffer) : Buffer {
    this.reqAesKey = data ? data : crypto.randomBytes(32)

    return this.reqAesKey
  }

  private getCipher(key : Buffer) {
    const cipher = crypto.createCipheriv(SYM_ALGO, key, IV)

    return cipher
  }

  private getDecipher(key : Buffer) {
    const decipher = crypto.createDecipheriv(SYM_ALGO, key, IV)

    return decipher
  }

  private decryptUsingReqAesKey(encData : Buffer) : Buffer {
    const decipher = this.getDecipher(this.reqAesKey),
          buff1    = decipher.update(encData),
          buff2    = decipher.final()

    return buff2.length ? Buffer.concat([buff1, buff2]) : buff1
  }

  private getFinalContentLength(contentLength : number) : number {
    const rem         = contentLength % SIXTEEN,
          finalLength = contentLength - rem + SIXTEEN

    return finalLength
  }


}