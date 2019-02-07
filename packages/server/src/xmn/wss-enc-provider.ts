/*------------------------------------------------------------------------------
   About      : Encryption-decryption provider for wss server
   
   Created on : Fri Jan 04 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import { 
         WireObject,
         DataLeader,
         Encoder,
         Mubble,
         WssProviderConfig
       }                    from '@mubble/core'
import { ObopayWssClient }  from './obopay-wss-client'
import * as crypto          from 'crypto'
import * as zlib            from 'zlib'

const BASE64   = 'base64',
      SYM_ALGO = 'aes-256-cbc',
      IV       = Buffer.from([ 0x01, 0x00, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00,
                               0x01, 0x00, 0x09, 0x00, 0x07, 0x00, 0x00, 0x00 ]),
      TS_LEN   = 24

export class WssEncProvider {

  private reqAesKey  : Buffer
  private respAesKey : Buffer

  public constructor(private privateKey : string) {

  }

  public getRespAesKey() : string {
    if(!this.respAesKey) this.respAesKey = this.getNewAesKey()

    return this.respAesKey.toString(BASE64)
  }

  public encodeResponseConfig(wssConfig : WssProviderConfig) : string {
    const encWssConfigBuf = this.encryptResponseConfig(wssConfig),
          encWssConfigStr = encWssConfigBuf.toString(BASE64)

    return encWssConfigStr
  }

  public decodeRequestUrl(encData : string, publicKey ?: string) : {
                                                                     tsMicro   : number
                                                                     wssConfig : WssProviderConfig
                                                                   } {

    const encTsMicro      = encData.slice(0, TS_LEN),
          encWssConfig    = encData.slice(TS_LEN),
          encTsMicroBuf   = Buffer.from(encTsMicro, BASE64),
          encWssConfigBuf = Buffer.from(encWssConfig, BASE64),
          wssConfig       = this.decryptRequestConfig(encWssConfigBuf)
      
    let tsMicro : number = 0
        
    if(wssConfig.key) {
      this.reqAesKey = Buffer.from(wssConfig.key, BASE64)

      tsMicro = Number(this.decryptUsingReqAesKey(encTsMicroBuf).toString())
    } else if(publicKey) {
      tsMicro = Number(this.decryptUsingPublicKey(encTsMicroBuf, publicKey).toString())
    }

    if(!tsMicro) throw new Error('Could not decode timestamp.')

    return {tsMicro, wssConfig}
  }

  public async decodeBody(totalBuf : Buffer) : Promise<Array<WireObject>> {
    const leaderBuf  = totalBuf.slice(0, 1),
          encDataBuf = totalBuf.slice(1),
          dataBuf    = this.decryptUsingRespAesKey(encDataBuf),
          leader     = Number(leaderBuf.toString())

    let dataStr = ''

    switch(leader) {
      case DataLeader.DEF_JSON :
        dataStr = (await Mubble.uPromise.execFn(zlib.inflate, zlib, dataBuf)).toString()
        break

      case DataLeader.JSON     :
        dataStr = dataBuf.toString()
        break
    }

    const data = JSON.parse(dataStr)
    return data
  }

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   PRIVATE METHODS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

  private encryptResponseConfig(wssConfig : WssProviderConfig) : Buffer {
    const wssConfigStr = JSON.stringify(wssConfig),
          wssConfigBuf = Buffer.from(wssConfigStr),
          encWssConfig = this.encryptUsingPrivateKey(wssConfigBuf)

    return encWssConfig
  }

  private decryptRequestConfig(encWssConfig : Buffer) : WssProviderConfig {
    const wssConfigBuf = this.decryptyUsingPrivateKey(encWssConfig),
          wssConfigStr = wssConfigBuf.toString(),
          wssConfig    = JSON.parse(wssConfigStr)

    return wssConfig
  }

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

  private decryptUsingReqAesKey(encData : Buffer) : Buffer {
    if(!this.reqAesKey) this.reqAesKey = this.getNewAesKey()

    const decipher = this.getDecipher(this.reqAesKey),
          buff1    = decipher.update(encData),
          buff2    = decipher.final()

    return buff2.length ? Buffer.concat([buff1, buff2]) : buff1
  }
  
  private decryptUsingRespAesKey(encData : Buffer) : Buffer {
    if(!this.respAesKey) this.respAesKey = this.getNewAesKey()

    const decipher = this.getDecipher(this.respAesKey),
          buff1    = decipher.update(encData),
          buff2    = decipher.final()

    return buff2.length ? Buffer.concat([buff1, buff2]) : buff1
  }

  private getCipher(key : Buffer) {
    const cipher = crypto.createCipheriv(SYM_ALGO, key, IV)

    return cipher
  }

  private getDecipher(key : Buffer) {
    const decipher = crypto.createDecipheriv(SYM_ALGO, key, IV)

    return decipher
  }

  private getNewAesKey() : Buffer {
    const key = crypto.randomBytes(32)

    return key
  }
}