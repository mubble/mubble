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

  public encodeRequestUrl(tsMicro : number, wssConfig : WssProviderConfig, publicKey : string) : string {

    if(!this.reqAesKey) this.reqAesKey = this.getNewAesKey()

    const encTsMicroBuf   = this.encryptUsingPrivateKey(Buffer.from(tsMicro.toString())),
          encReqKeyBuf    = this.encryptUsingPublicKey(this.reqAesKey, publicKey),
          encWssConfigBuf = this.encryptRequestConfig(wssConfig),
          encTsMicro      = encTsMicroBuf.toString(BASE64),
          encReqKey       = encReqKeyBuf.toString(BASE64),
          encWssConfig    = encWssConfigBuf.toString(BASE64)

    return `${encTsMicro}${encReqKey}${encWssConfig}`
  }

  public decodeRequestUrl(encData : string, publicKey ?: string) : {
                                                                     tsMicro   : number
                                                                     wssConfig : WssProviderConfig
                                                                   } {

    const tsLen           = publicKey ? REQ_KEY_LEN : TS_LEN,
          encTsMicro      = encData.slice(0, tsLen),
          encReqKey       = encData.slice(tsLen, tsLen + REQ_KEY_LEN),
          encWssConfig    = encData.slice(tsLen + REQ_KEY_LEN),
          encTsMicroBuf   = Buffer.from(encTsMicro, BASE64),
          encReqKeyBuf    = Buffer.from(encReqKey, BASE64),
          encWssConfigBuf = Buffer.from(encWssConfig, BASE64)

    this.reqAesKey = this.decryptyUsingPrivateKey(encReqKeyBuf)

    const wssConfig = this.decryptRequestConfig(encWssConfigBuf)

    let tsMicro : number

    if(publicKey) {
      tsMicro = Number(this.decryptUsingPublicKey(encTsMicroBuf, publicKey).toString())
    } else {
      tsMicro = Number(this.decryptUsingAesKey(this.reqAesKey, encTsMicroBuf).toString())
    }

    return {tsMicro, wssConfig}
  }

  public async encodeHandshakeMessage(wo : WireObject) : Promise<Buffer> {

    const woStr = wo.stringify()

    let leader  = DataLeader.ENC_JSON,
        dataBuf = Buffer.from(woStr)

    if (woStr.length > Encoder.MIN_SIZE_TO_COMPRESS) {
      dataBuf = await Mubble.uPromise.execFn(zlib.deflate, zlib, woStr)
      leader  = DataLeader.ENC_DEF_JSON
    }

    const encDataBuf = this.encryptUsingAesKey(this.reqAesKey, dataBuf),
          leaderBuf  = Buffer.from([leader]),
          totalBuf   = Buffer.concat([leaderBuf, encDataBuf])

    return totalBuf
  }

  public async decodeHandshakeMessage(totalBuf : Buffer) : Promise<WireObject> {
    const leaderBuf  = totalBuf.slice(0, 1),
          encDataBuf = totalBuf.slice(1),
          leader     = leaderBuf[0]

    let dataBuf = this.decryptUsingAesKey(this.reqAesKey, encDataBuf)

    if (leader === DataLeader.ENC_DEF_JSON) {
      dataBuf = await Mubble.uPromise.execFn(zlib.inflate, zlib, encDataBuf)
    }
    
    const woStr = dataBuf.toString(),
          wo    = JSON.parse(woStr)

    this.respAesKey = Buffer.from(wo.data.key, BASE64)

    return wo
  }

  public async encodeBody(woArr : Array<WireObject>, app : boolean) : Promise<Buffer> {

    const dataStr = app ? this.stringifyWireObjects(woArr) : JSON.stringify(woArr)

    let leader  = DataLeader.ENC_JSON,
        dataBuf = Buffer.from(dataStr)

    if(dataStr.length >= Encoder.MIN_SIZE_TO_COMPRESS) {
      dataBuf = await Mubble.uPromise.execFn(zlib.deflate, zlib, dataStr)
      leader  = DataLeader.ENC_DEF_JSON
    }

    const encDataBuf = this.encryptUsingAesKey(this.respAesKey, dataBuf),
          leaderBuf  = Buffer.from([leader]),
          totalBuf   = Buffer.concat([leaderBuf, encDataBuf])

    return totalBuf
  }

  public async decodeBody(totalBuf : Buffer, app : boolean) : Promise<Array<WireObject>> {

    const leaderBuf = totalBuf.slice(0, 1),
          leader    = [...leaderBuf][0]

    let dataBuf = totalBuf.slice(1)

    switch(leader) {
      case DataLeader.ENC_DEF_JSON :
        dataBuf = this.decryptUsingAesKey(this.respAesKey, dataBuf)

      case DataLeader.DEF_JSON :
        dataBuf = await Mubble.uPromise.execFn(zlib.inflate, zlib, dataBuf)
        break

      case DataLeader.ENC_JSON :
        dataBuf = this.decryptUsingAesKey(this.respAesKey, dataBuf)
        break
    }

    const dataStr = dataBuf.toString(),
          woArr   = app ? this.parseWireObjectsString(dataStr) : JSON.parse(dataStr)

    return woArr
  }

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   PRIVATE METHODS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

  private encryptRequestConfig(wssConfig : WssProviderConfig) : Buffer {
    const wssConfigStr = JSON.stringify(wssConfig),
          wssConfigBuf = Buffer.from(wssConfigStr),
          encWssConfig = this.encryptUsingAesKey(this.reqAesKey, wssConfigBuf)

    return encWssConfig
  }

  private decryptRequestConfig(encWssConfig : Buffer) : WssProviderConfig {
    const wssConfigBuf = this.decryptUsingAesKey(this.reqAesKey, encWssConfig),
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

  private encryptUsingAesKey(key : Buffer, data : Buffer) : Buffer {
    const cipher = crypto.createCipheriv(SYM_ALGO, key, IV),
          buff1  = cipher.update(data),
          buff2  = cipher.final()
          
    return buff2.length ? Buffer.concat([buff1, buff2]) : buff1
  }

  private decryptUsingAesKey(key : Buffer, encData : Buffer) : Buffer {
    const decipher = crypto.createDecipheriv(SYM_ALGO, key, IV),
          buff1    = decipher.update(encData),
          buff2    = decipher.final()

    return buff2.length ? Buffer.concat([buff1, buff2]) : buff1
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
    
    return leader
  }

  private encryptBinaryBody(data : WireObject) {
    const dataBuf    = Buffer.concat([Buffer.from(data.stringify() + '\n'), data.data as Buffer]),
          encDataBuf = this.encryptUsingAesKey(this.respAesKey, dataBuf) 

    return encDataBuf
  }

  private stringifyWireObjects(woArr : Array<WireObject>) : string {
    const strArr = woArr.map(wo => wo.stringify()),
          str    = JSON.stringify(strArr)

    return str
  }

  private parseWireObjectsString(str : string) : Array<WireObject> {

    const inJson    = JSON.parse(str),
          arData    = Array.isArray(inJson) ? inJson : [inJson]

    return arData
  }
}