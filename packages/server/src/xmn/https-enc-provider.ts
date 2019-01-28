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
      IV                      = new Buffer([ 0x01, 0x00, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00,
                                             0x01, 0x00, 0x09, 0x00, 0x07, 0x00, 0x00, 0x00 ]),
      MIN_SIZE_TO_COMPRESS    = 1000,
      BASE64                  = 'base64'
      // RSA_OAEP_PKCS1_PADDDING = 4         // TODO : Need fix? Why crypto.constants not working?

export class HttpsEncProvider {

  private symmKey    : Buffer
  private privateKey : string

  public constructor(pk : string) {
    this.privateKey = pk
  }

  public encodeSymmKey(publicKey : string) : string {
    if(!this.symmKey) this.setSymmKey()

    const encSymmKey = (crypto.publicEncrypt(publicKey, this.symmKey)).toString(BASE64)

    return encSymmKey
  }

  public decodeSymmKey(encSymmKey : string) : Buffer {
    const encSymmKeyBuf = new Buffer(encSymmKey, BASE64)

    this.symmKey = crypto.privateDecrypt(this.privateKey, encSymmKeyBuf)

    return this.symmKey
  }

  public encodeRequestTs(ts : number) : string {
    const encReqTs = this.encryptRequestTs(ts)

    return encReqTs
  }

  public decodeRequestTs(publicKey : string, encReqTs  : string) {
    const requestTs = this.decryptRequestTs(publicKey, encReqTs)

    return requestTs
  }

  public encodeBody(data : Mubble.uObject<any>) : {
                                                    streams       : Array<stream.Writable>,
                                                    dataStr       : string,
                                                    bodyEncoding  : string,
                                                    chunked       : boolean,
                                                  } {

    return this.encryptBody(data)
  }

  public decodeBody(streams  : Array<stream.Readable>,
                    encoding : string) : Array<stream.Readable> {
    
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

    return streams
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

  private encryptBody(json : Mubble.uObject<any>) : {
                                                     streams       : Array<stream.Writable>,
                                                     dataStr       : string,
                                                     bodyEncoding  : string,
                                                     chunked       : boolean,
                                                    } {

    const jsonStr = JSON.stringify(json),
          streams = [] as Array<stream.Writable>

    let chunked      : boolean = false,
        bodyEncoding : string  = HTTP.HeaderValue.identity

    streams.unshift(this.getCipher() as any)

    if(jsonStr.length > MIN_SIZE_TO_COMPRESS) {
      bodyEncoding = HTTP.HeaderValue.deflate
      chunked      = true
      streams.unshift(zlib.createDeflate())
    }

    return {streams, dataStr : jsonStr, bodyEncoding, chunked}
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
    const decipher = crypto.createDecipheriv(SYM_ALGO, this.symmKey, IV)

    return decipher
  }


}