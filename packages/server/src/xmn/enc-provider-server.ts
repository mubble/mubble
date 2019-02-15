/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Thu Jun 29 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { RunContextServer }     from '../rc-server'
import { 
         WireObject,
         DataLeader,
         Mubble,
         Encoder,
         SessionInfo,
         ConnectionInfo
       }                        from '@mubble/core'
import * as zlib                from 'zlib'
import * as crypto              from 'crypto'
import * as constants           from 'constants'

const IV = Buffer.alloc(16)

export class EncProviderServer {

  private syncKey : any

  constructor(rc: RunContextServer, private ci: ConnectionInfo, private si : SessionInfo) {

  }

  extractHeader(rc: RunContextServer, data: Buffer) {

    rc.isAssert() && rc.assert(rc.getName(this), data.length >= 7, 'Incorrect header')
    this.setShortName(rc, data.slice(0, 4))
    this.setUniqueId(rc, data.slice(4, 7))

    // console.log('shortName', this.ci.shortName)
    // console.log('uniqueId', this.ci.uniqueId)
  }

  decodeHeader(rc: RunContextServer, data: Buffer, pk: string | null): void {

    const endPtr  = this.extractKey(rc, data, pk),
          headers = JSON.parse(this.decrypt(data.slice(endPtr)).toString()),
          diff    = Date.now() - headers.now

    this.ci.msOffset = Math.abs(diff) > 5000 ? diff : 0
    
    delete headers.networkType
    delete headers.location
    delete headers.now

    this.ci.customData  = headers
  }

  setNewKey(syncKey: any) {

  }

  extractKey(rc: RunContextServer, data: Buffer, pk: string | null) {

    const startPtr  = 7
    // if (!this.si.useEncryption) return startPtr

    const endPtr    = 7 + 256,
          encKey    = data.slice(startPtr, endPtr)

    rc.isAssert() && rc.assert(rc.getName(this), data.length !== 256, 'Incorrect header')

    if (pk) this.syncKey = crypto.privateDecrypt({key: pk, padding: constants.RSA_PKCS1_OAEP_PADDING}, encKey)
    return endPtr
  } 

  async decodeBody(rc: RunContextServer, data: Buffer): Promise<[WireObject]> {

    const leader    = Number(data[0]),
          outBuff   = this.decrypt(data.slice(1)),
          jsonStr   = leader !== DataLeader.DEF_JSON ? outBuff.toString() :
                      (await Mubble.uPromise.execFn(zlib.inflate, zlib, outBuff)).toString(),
                      // a = console.log(jsonStr),
          inJson    = JSON.parse(jsonStr),
          arData    = Array.isArray(inJson) ? inJson : [inJson]
  
    for (let index = 0; index < arData.length; index++) {
      arData[index] = WireObject.getWireObject(arData[index])
    }

    return arData as [WireObject]
  }

  encodeHeader(rc: RunContextServer): any {
    rc.isError() && rc.error(rc.getName(this), 'encodeHeader not implemented')
  }

  // Should return binary buffer
  async encodeBody(rc: RunContextServer, arData: WireObject[], config ?: boolean) {

    const arStrData = []
    for (const data of arData) {
      if (data.data instanceof Buffer) {
        rc.isAssert() && rc.assert(rc.getName(this), arData.length === 1, 
          'Binary data cannot be sent as array of messages')
        return this.encodeBinaryBody(rc, data)
      }
      arStrData.push(data.stringify())
    }

    const str = arStrData.length === 1 ? arStrData[0] : JSON.stringify(arStrData)
    let   firstPassBuffer,
          leader = DataLeader.JSON

    if (str.length > Encoder.MIN_SIZE_TO_COMPRESS && !config) {
      const buf = await Mubble.uPromise.execFn(zlib.deflate, zlib, str)
      if (buf.length < str.length) {
        firstPassBuffer = buf
        leader = DataLeader.DEF_JSON
      }
    }

    if (!firstPassBuffer) firstPassBuffer = new Buffer(str)
    return Buffer.concat([new Buffer([leader]), this.encrypt(firstPassBuffer)])
  }

  public getNewKey() {
    const key = crypto.randomBytes(32)
    this.syncKey = key
    return {key, encKey: this.encrypt(key)}
  }

  private encrypt(buffer: Buffer) {

    // if (!this.si.useEncryption) return buffer
    // console.log('encrypt', this.ci.syncKey.length, this.ci.syncKey)

    const cipher  = crypto.createCipheriv('aes-256-cbc', this.syncKey, IV),
          outBuf1 = cipher.update(buffer),
          outBuf2 = cipher.final()

    return outBuf2.length ? Buffer.concat([outBuf1, outBuf2]) : outBuf1
  }

  private encodeBinaryBody(rc: RunContextServer, data: WireObject) {
    const encData = this.encrypt(Buffer.concat([new Buffer(data.stringify() + '\n'), data.data as Buffer])) 
    return Buffer.concat([new Buffer(DataLeader.BINARY), encData])
  }

  private decrypt(buffer: Buffer) {

    // if (!this.si.useEncryption) return buffer

    const decipher  = crypto.createDecipheriv('aes-256-cbc', this.syncKey, IV),
          outBuf1   = decipher.update(buffer),
          outBuf2   = decipher.final()

    return outBuf2.length ? Buffer.concat([outBuf1, outBuf2]) : outBuf1
  }

  private setShortName(rc: RunContextServer, buffer: Buffer) {

    let index = 0
    while (index < 4) {
      if (buffer[index] === 0) break
      buffer[index] += 40
      const str = String.fromCharCode(buffer[index++])
      if (!str.match(/[a-zA-Z0-9]/)) throw('setShortName: invalid data')
    }

    this.ci.shortName = buffer.slice(0, index).toString()
    if (!this.ci.shortName) throw('setShortName: unknown client')
  }

  private setUniqueId(rc: RunContextServer, buffer: Buffer) {

    const ar = [buffer[0], buffer[1], buffer[2]]
    ar.forEach(num => {
      if (num > 99) throw('setUniqueId: invalid data')
    })
    // this.ci.customData.uniqueId = ar.join('.')
  }
}
