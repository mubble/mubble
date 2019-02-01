/*------------------------------------------------------------------------------
   About      : Encryption-decryption provider for wss server
   
   Created on : Fri Jan 04 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import { 
         WireObject,
         Leader,
         getLeaderByte,
         getLeader,
         Encoder,
         Mubble
       }                  from '@mubble/core'
import * as crypto        from 'crypto'
import * as zlib          from 'zlib'

const BASE64   = 'base64',
      BINARY   = 'binary',
      SYM_ALGO = 'aes-256-cbc',
      IV       = Buffer.from([ 0x01, 0x00, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00,
                               0x01, 0x00, 0x09, 0x00, 0x07, 0x00, 0x00, 0x00 ])

export class WssEncProvider {

  private aesKey : Buffer

  public constructor(private privateKey : string) {

  }

  public encodeTsMicro(tsMicro : number, aes ?: boolean) : string {
    const tsMicroStr  = tsMicro.toString(),
          tsMicroBuff = Buffer.from(tsMicroStr)

    if(aes) {
      const encTsMicroBuff = this.encryptUsingAesKey(tsMicroBuff),
            encTsMicroStr  = encTsMicroBuff.toString(BASE64)

      return encTsMicroStr
    }

    const encTsMicroBuff = this.encryptUsingPrivateKey(tsMicroBuff),
          encTsMicroStr  = encTsMicroBuff.toString(BASE64)

    return encTsMicroStr
  }

  public decodeTsMicro(encTsMicro : string, key : string, aes ?: boolean) : number {
    const encTsMicroBuff = Buffer.from(encTsMicro, BASE64)

    if(aes) {

      const tsMicroBuff = this.decryptUsingAesKey(encTsMicroBuff, key),
            tsMicroStr  = tsMicroBuff.toString(),
            tsMicro     = Number(tsMicroStr)

      return tsMicro
    }

    const tsMicroBuff    = this.decryptUsingPublicKey(encTsMicroBuff, key),
          tsMicroStr     = tsMicroBuff.toString(),
          tsMicro        = Number(tsMicroStr)

    return tsMicro
  }

  public async encodeBody(publicKey : string, wo : WireObject, msgType ?: string) : Promise<string> {
    const strData = JSON.stringify(wo),
          leader  = msgType || strData.length >= Encoder.MIN_SIZE_TO_COMPRESS
                               ? Leader.DEF_JSON
                               : Leader.JSON

    let woBuffer : Buffer = Buffer.from(strData)

    switch(leader) {
      case Leader.DEF_JSON :
        woBuffer = await Mubble.uPromise.execFn(zlib.deflate, zlib, strData)
        break
      
      case Leader.BIN :
        woBuffer = Buffer.from(strData, BINARY)
        break
    }

    const leaderBuff  = Buffer.from(getLeaderByte(leader)),
          dataBuff    = Buffer.concat([leaderBuff, woBuffer]),
          encDataBuff = this.encryptUsingPublicKey(dataBuff, publicKey),
          encDataStr  = encDataBuff.toString(BASE64)

    return encDataStr    
  }

  public async decodeBody(encDataStr : string) : Promise<WireObject> {
    const encDataBuff = Buffer.from(encDataStr, BASE64),
          dataBuff    = this.decryptyUsingPrivateKey(encDataBuff),
          leader      = getLeader(dataBuff[0]),
          woBuffer    = dataBuff.slice(1)

    let strData : string = woBuffer.toString()

    switch(leader) {
      case Leader.DEF_JSON :
        strData = (await Mubble.uPromise.execFn(zlib.inflate, zlib, woBuffer)).toString()
        break

      case Leader.BIN :
        strData = woBuffer.toString(BINARY)
        break
    }

    const wo = JSON.parse(strData) as WireObject
    return wo
  }

  public genereateNewAesKey() : string {
    if(!this.aesKey) this.setAesKey()

    return this.aesKey.toString(BASE64)
  }


/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   PRIVATE METHODS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

  private encryptUsingPrivateKey(data : Buffer) : Buffer {
    const encData  = crypto.privateEncrypt(this.privateKey, data)

    return encData
  }

  private decryptyUsingPrivateKey(encData : Buffer) : Buffer {
    const data = crypto.privateDecrypt(this.privateKey, encData)

    return data
  }

  private encryptUsingPublicKey(data : Buffer, publicKey : string) : Buffer {
    const encDataBuf = crypto.publicEncrypt(publicKey, data)

    return encDataBuf
  }

  private decryptUsingPublicKey(encData : Buffer, publicKey : string) : Buffer {
    const data = crypto.publicDecrypt(publicKey, encData)

    return data
  }

  private encryptUsingAesKey(data : Buffer) : Buffer {
    if(!this.aesKey) this.setAesKey()

    const cipher = crypto.createCipheriv(SYM_ALGO, this.aesKey, IV),
          buff1  = cipher.update(data),
          buff2  = cipher.final()

    return buff2.length ? Buffer.concat([buff1, buff2]) : buff1
  }

  private decryptUsingAesKey(encData : Buffer, aesKey : string) : Buffer {
    this.setAesKey(aesKey)

    const decipher = crypto.createDecipheriv(SYM_ALGO, this.aesKey, IV),
          buff1    = decipher.update(encData),
          buff2    = decipher.final()

    return buff2.length ? Buffer.concat([buff1, buff2]) : buff1
  }

  private setAesKey(keyStr ?: string) {
    this.aesKey = keyStr ? Buffer.from(keyStr, BASE64)
                         : crypto.randomBytes(32)
  }
}