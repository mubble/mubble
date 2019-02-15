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
import * as crypto          from 'crypto'
import * as zlib            from 'zlib'
import { RunContextServer } from '../rc-server';

const BASE64      = 'base64',
      SYM_ALGO    = 'aes-256-cbc',
      IV          = Buffer.from([ 0x01, 0x00, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00,
                                  0x01, 0x00, 0x09, 0x00, 0x07, 0x00, 0x00, 0x00 ]),
      TS_LEN      = 44,
      REQ_KEY_LEN = 344

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
          encReqKey       = encData.slice(TS_LEN, TS_LEN + REQ_KEY_LEN),
          encWssConfig    = encData.slice(TS_LEN + REQ_KEY_LEN),
          encTsMicroBuf   = Buffer.from(encTsMicro, BASE64),
          encReqKeyBuf    = Buffer.from(encReqKey, BASE64),
          encWssConfigBuf = Buffer.from(encWssConfig, BASE64)

    this.reqAesKey = this.decryptyUsingPrivateKey(encReqKeyBuf)

    const wssConfig = this.decryptRequestConfig(encWssConfigBuf)

    let tsMicro   : number = 0
        
    // if(wssConfig.key) {
    //   this.reqAesKey = Buffer.from(wssConfig.key, BASE64)

      tsMicro = Number(this.decryptUsingReqAesKey(encTsMicroBuf).toString())
    // } else if(publicKey) {
    //   tsMicro = Number(this.decryptUsingPublicKey(encTsMicroBuf, publicKey).toString())
    // }

    if(!tsMicro) throw new Error('Could not decode timestamp.')

    return {tsMicro, wssConfig}
  }

  public async encodeHandshakeMsg(wo: WireObject) {

    console.log(`Came to encodeHandshakeMsg`)

    const woStr = wo.stringify()
    let   firstPassBuffer,
          leader = DataLeader.ENC_JSON

    if (woStr.length > Encoder.MIN_SIZE_TO_COMPRESS) {
      const buf = await Mubble.uPromise.execFn(zlib.deflate, zlib, woStr)

      if (buf.length < woStr.length) {
        firstPassBuffer = buf
        leader          = DataLeader.ENC_DEF_JSON
      }
    }

    if (!firstPassBuffer) firstPassBuffer = new Buffer(woStr)
    return Buffer.concat([new Buffer([leader]), this.encryptUsingReqAesKey(firstPassBuffer)])
  }

  public async encodeBody(rc: RunContextServer, woArr : Array<WireObject>, 
                          useEncryption : boolean) : Promise<Buffer> {

    const woArrData = []
    for (const wo of woArr) {
      if (wo.data instanceof Buffer) {
        rc.isAssert() && rc.assert(rc.getName(this), woArr.length === 1, 
          'Binary data cannot be sent as array of messages')
        return this.encodeBinaryBody(rc, wo)
      }
      woArrData.push(wo.stringify())
    }

    const str = woArrData.length === 1 ? woArrData[0] : JSON.stringify(woArrData)
    let   buffer,
          deflate = false

    if (str.length > Encoder.MIN_SIZE_TO_COMPRESS) {
      const buf = await Mubble.uPromise.execFn(zlib.deflate, zlib, str)
      if (buf.length < str.length) {
        buffer  = buf
        deflate = true
      }
    }

    if (!buffer) buffer = new Buffer(str)
    const leader = deflate ? DataLeader.ENC_DEF_JSON : DataLeader.ENC_JSON
    return Buffer.concat([new Buffer([leader]), this.encryptUsingRespAesKey(buffer)])

    // const jsonStr     = JSON.stringify(woArr),
    //       jsonBuf     = Buffer.from(jsonStr),
    //       encJsonBuf  = useEncryption ? this.encryptUsingRespAesKey(jsonBuf) : jsonBuf,
    //       compress    = encJsonBuf.length >= Encoder.MIN_SIZE_TO_COMPRESS,
    //       leader      = this.getLeader(compress, useEncryption, false),
    //       leaderBuf   = Buffer.from([leader])

    // let dataStr = ''

    // switch(leader) {
    //   case DataLeader.DEF_JSON :
    //   case DataLeader.ENC_DEF_JSON :
    //     dataStr = (await Mubble.uPromise.execFn(zlib.deflate, zlib, encJsonBuf)).toString()
    //     break

    //   case DataLeader.JSON :
    //   case DataLeader.ENC_JSON :
    //     dataStr = encJsonBuf.toString()
    //     break
    // }

    // const dataBuf  = Buffer.from(dataStr),
    //       totalBuf = Buffer.concat([leaderBuf, dataBuf])

    // return totalBuf
  }

  public async decodeBody(totalBuf : Buffer) : Promise<Array<WireObject>> {
    const leaderBuf = totalBuf.slice(0, 1),
          dataBuf   = totalBuf.slice(1),
          leader    = [...leaderBuf][0]

    let jsonStr = ''

    switch(leader) {
      case DataLeader.ENC_DEF_JSON :
        const encJsonBuf = await Mubble.uPromise.execFn(zlib.inflate, zlib, dataBuf),
              jsonBuf    = this.decryptUsingRespAesKey(encJsonBuf)

        jsonStr = jsonBuf.toString()
        break

      case DataLeader.DEF_JSON :
        jsonStr = (await Mubble.uPromise.execFn(zlib.inflate, zlib, dataBuf)).toString()
        break

      case DataLeader.ENC_JSON :
        jsonStr = this.decryptUsingRespAesKey(dataBuf).toString()
        break

      case DataLeader.JSON :
        jsonStr = dataBuf.toString()
        break
    }

    const woArr = JSON.parse(jsonStr)
    return woArr
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
    const wssConfigBuf = this.decryptUsingReqAesKey(encWssConfig),
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

  // ????? Convert to async
  private encryptUsingReqAesKey(data : Buffer) : Buffer {

    const cipher = this.getCipher(this.reqAesKey),
          buff1  = cipher.update(data),
          buff2  = cipher.final()

    return buff2.length ? Buffer.concat([buff1, buff2]) : buff1
  }

  private encryptUsingRespAesKey(data : Buffer) : Buffer {
    if(!this.respAesKey) this.respAesKey = this.getNewAesKey()
    const cipher = this.getCipher(this.respAesKey),
          buff1  = cipher.update(data),
          buff2  = cipher.final()

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

  private getLeader(compress : boolean, encrypt : boolean, binary : boolean) : number {
    const leader = binary ? encrypt ? DataLeader.ENC_BINARY
                                    : DataLeader.BINARY
                          : compress ? encrypt ? DataLeader.ENC_DEF_JSON
                                               : DataLeader.DEF_JSON
                                     : encrypt ? DataLeader.ENC_JSON
                                               : DataLeader.JSON
console.log('\nleader : ' + leader + '\n')
    return leader
  }

  private encodeBinaryBody(rc: RunContextServer, data: WireObject) {
    const encData = this.encryptUsingRespAesKey(Buffer.concat([new Buffer(data.stringify() + '\n'), data.data as Buffer])) 
    return Buffer.concat([new Buffer(DataLeader.BINARY), encData])
  }

}