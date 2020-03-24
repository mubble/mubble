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
import { RunContextServer }   from '../rc-server'
import * as crypto            from 'crypto'
import * as zlib              from 'zlib'
import * as stream            from 'stream'

const SYM_ALGO                = 'aes-256-cbc',
      IV                      = Buffer.from([ 0x01, 0x00, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00,
                                              0x01, 0x00, 0x09, 0x00, 0x07, 0x00, 0x00, 0x00 ]),
      MIN_SIZE_TO_COMPRESS    = 1000,
      AES_KEY_SIZE            = 32,
      BASE64                  = 'base64',
      SIXTEEN                 = 16

export class HttpsEncProvider {

  private reqAesKey  : Buffer
  private respAesKey : Buffer
  private privateKey : string

  public constructor(pk : string) {
    this.privateKey = pk
  }

  public encodeRequestKey(rc : RunContextServer, publicKey : string) : string {
    if(!this.reqAesKey) this.reqAesKey = this.getNewAesKey()

    const encKeyBuf = this.encryptUsingPublicKey(publicKey, this.reqAesKey),
          encKey    = encKeyBuf.toString(BASE64)

    rc.isDebug() && rc.debug(rc.getName(this), 'encodeRequestKey encKey', encKey)
    rc.isDebug() && rc.debug(rc.getName(this), 'encodeRequestKey publicKey', publicKey)

    return encKey
  }

  public decodeRequestKey(rc : RunContextServer, encKey : string) : Buffer {

    rc.isDebug() && rc.debug(rc.getName(this), 'decodeRequestKey encKey', encKey)
    rc.isDebug() && rc.debug(rc.getName(this), 'decodeRequestKey privateKey', this.privateKey)

    const encKeyBuf = Buffer.from(encKey, BASE64)

    this.reqAesKey = this.decryptUsingPrivateKey(encKeyBuf)

    return this.reqAesKey
  }

  public encodeRequestTs(rc : RunContextServer, ts : number) : string {

    rc.isDebug() && rc.debug(rc.getName(this), 'encodeRequestTs ts', ts)
    rc.isDebug() && rc.debug(rc.getName(this), 'encodeRequestTs privateKey', this.privateKey)

    const encReqTs = this.encryptRequestTs(ts)

    return encReqTs
  }

  public decodeRequestTs(rc : RunContextServer, publicKey : string, encReqTs : string) {

    rc.isDebug() && rc.debug(rc.getName(this), 'decodeRequestTs encReqTs', encReqTs)
    rc.isDebug() && rc.debug(rc.getName(this), 'decodeRequestTs publicKey', publicKey)

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
    
    return this.decryptBody(streams, encoding, response)
  }

  public encodeResponseKey(rc : RunContextServer) : string {
    if(!this.respAesKey) this.respAesKey = this.getNewAesKey()

    const encKeyBufTemp = this.encryptUsingReqAesKey(this.respAesKey),
          encKeyBufFin  = this.encryptUsingPrivateKey(encKeyBufTemp),
          encKey        = encKeyBufFin.toString(BASE64)

    rc.isDebug() && rc.debug(rc.getName(this), 'encodeResponseKey encKey', encKey)
    rc.isDebug() && rc.debug(rc.getName(this), 'encodeResponseKey privateKey', this.privateKey)

    return encKey
  }

  public decodeResponseKey(rc : RunContextServer, publicKey : string, encKey : string) : Buffer {

    rc.isDebug() && rc.debug(rc.getName(this), 'decodeResponseKey encKey', encKey)
    rc.isDebug() && rc.debug(rc.getName(this), 'decodeResponseKey publicKey', publicKey)

    const encKeyBuf = Buffer.from(encKey, BASE64),
          decKey    = this.decryptUsingPublicKey(publicKey, encKeyBuf)
    
    this.respAesKey = this.decryptUsingReqAesKey(decKey)
    return this.respAesKey
  }

  public encodeThirdPartyRequestPath(data : Mubble.uObject<any>) : string {
    return JSON.stringify(data)
  }

  public decodeThirdPartyRequestPath(encDataStr : string) : Mubble.uObject<any> {
    return JSON.parse(encDataStr)
  }

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   PRIVATE METHODS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

  private encryptRequestTs(tsMicro : number) : string {
    const encReqTs = this.encryptUsingPrivateKey(Buffer.from(tsMicro.toString()))

    return encReqTs.toString(BASE64)
  }

  private decryptRequestTs(publicKey : string, encReqTs : string) : number {
    const encReqTsBuf = Buffer.from(encReqTs, BASE64),
          reqTsBuf    = this.decryptUsingPublicKey(publicKey, encReqTsBuf),
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

    if(!this.reqAesKey)  this.reqAesKey  = this.getNewAesKey()
    if(!this.respAesKey) this.respAesKey = this.getNewAesKey()

    const key = response ? this.respAesKey : this.reqAesKey

    streams.push(this.getCipher(key) as any)

    return {streams, dataStr : jsonStr, bodyEncoding, contentLength}
  }

  private decryptBody(streams  : Array<stream.Readable>,
                      encoding : string,
                      response : boolean) : Array<stream.Readable> {
    
    const key      = response ? this.respAesKey : this.reqAesKey,
          decipher = this.getDecipher(key)

    streams.push(decipher as any)

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

  private getNewAesKey() : Buffer {
    const key = crypto.randomBytes(AES_KEY_SIZE)

    return key
  }

  private getCipher(key : Buffer) {
    const cipher = crypto.createCipheriv(SYM_ALGO, key, IV)

    return cipher
  }

  private getDecipher(key : Buffer) {
    const decipher = crypto.createDecipheriv(SYM_ALGO, key, IV)

    return decipher
  }

  private encryptUsingReqAesKey(data : Buffer) : Buffer {
    const cipher = this.getCipher(this.reqAesKey),
          buff1  = cipher.update(data),
          buff2  = cipher.final()

    return buff2.length ? Buffer.concat([buff1, buff2]) : buff1
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

  private encryptUsingPublicKey(publicKey : string, data : Buffer) : Buffer {
    const encData = crypto.publicEncrypt(publicKey, data)

    return encData
  }

  private decryptUsingPublicKey(publicKey : string, encData : Buffer) : Buffer {
    const data = crypto.publicDecrypt(publicKey, encData)

    return data
  }

  private encryptUsingPrivateKey(data : Buffer) : Buffer {
    const encData = crypto.privateEncrypt(this.privateKey, data)

    return encData
  }

  private decryptUsingPrivateKey(encData : Buffer) : Buffer {
    const data = crypto.privateDecrypt(this.privateKey, encData)

    return data
  }

}