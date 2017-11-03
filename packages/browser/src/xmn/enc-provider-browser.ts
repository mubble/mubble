/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Mon Jun 26 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { 
  ConnectionInfo,
  WireObject,
  Leader,
  Encoder
} from '@mubble/core'

import * as pako from 'pako'

import {  RunContextBrowser} from '../rc-browser'

const IV                    = new Uint8Array(16),
      SYM_ALGO              = {name: "AES-CBC", iv: IV, length: 256},
      ASYM_ALGO             = {name: 'RSA-OAEP', hash: {name: 'SHA-1'}}

let arShortCode
let arUniqueId

export class EncryptionBrowser {

  constructor(rc: RunContextBrowser, private ci: ConnectionInfo, private syncKey: Uint8Array) {

    if (!arShortCode) this.extractShortCode(rc, ci.shortName)
    if (!arUniqueId) this.extractUniqueId(rc, ci.uniqueId)
  }

  // Should return binary buffer
  async encodeHeader(rc: RunContextBrowser) {

    await this.ensureSyncKey()
    
    const buffer = await crypto.subtle.exportKey('raw', this.ci.syncKey),
          key    = await crypto.subtle.importKey('spki', this.syncKey, ASYM_ALGO , false, ['encrypt']),
          encKey = await crypto.subtle.encrypt(ASYM_ALGO, key, buffer),
          obj    = {
            networkType : this.ci.networkType,
            location    : this.ci.location,
            now         : Date.now()
          }

    Object.assign(obj, this.ci.clientIdentity)

    const header    = this.strToUnit8Ar(JSON.stringify(obj)),
          encHeader =  await crypto.subtle.encrypt(SYM_ALGO, this.ci.syncKey, header)

    const arOut = new Uint8Array(arShortCode.length + arUniqueId.length + encKey.byteLength + encHeader.byteLength)
    let copied = 0

    arOut.set(arShortCode)
    copied += arShortCode.length

    arOut.set(arUniqueId, copied)
    copied += arUniqueId.length

    arOut.set(new Uint8Array(encKey), copied)
    copied += encKey.byteLength
    
    arOut.set(new Uint8Array(encHeader), copied)
    copied += encHeader.byteLength
    
    return arOut
  }

  async encodeBody(rc: RunContextBrowser, data: WireObject | WireObject[]): Promise<Uint8Array> {

    const str = Array.isArray(data) ? this.stringifyWireObjects(data) : data.stringify()
    let   firstPassArray,
          leader

    if (str.length > Encoder.MIN_SIZE_TO_COMPRESS) {
      const ar = pako.deflate(str)
      if (ar.length < str.length) {
        firstPassArray = ar
        leader         = Leader.DEF_JSON
      }
    }

    if (!firstPassArray) {
      firstPassArray = this.strToUnit8Ar(str)
      leader         = Leader.JSON
    }

    await this.ensureSyncKey()
    const secondPassArray = new Uint8Array(await crypto.subtle.encrypt(SYM_ALGO, this.ci.syncKey, firstPassArray)),
          arOut = new Uint8Array(secondPassArray.byteLength + 1)

    arOut.set([leader.charCodeAt(0)])
    arOut.set(secondPassArray, 1)

    return arOut
  }

  private stringifyWireObjects(objects: WireObject[]) {

    const strArray = objects.map(wm => wm.stringify())
    return `[${strArray.join(', ')}]`
  }

  async decodeBody(rc: RunContextBrowser, data: ArrayBuffer): Promise<[WireObject]> {

    await this.ensureSyncKey()

    const inAr    = new Uint8Array(data, 1),
          ar      = new Uint8Array(data, 0, 1),
          leader  = String.fromCharCode(ar[0]),
          temp    = new Uint8Array(await crypto.subtle.decrypt(SYM_ALGO, this.ci.syncKey, inAr))

    let inJsonStr
    if (leader === Leader.DEF_JSON) {
      inJsonStr = pako.inflate(temp, {to: 'string'})
    } else {
      inJsonStr = String.fromCharCode(...temp as any)
    }

    const inJson = JSON.parse(inJsonStr),
          arData = Array.isArray(inJson) ? inJson : [inJson]
  
    for (let index = 0; index < arData.length; index++) {
      rc.isDebug() && rc.debug(rc.getName(this), 'Decoded Xmn Message Body', {
        name        : arData[index].name, 
        wire        : data.byteLength, 
        json        : inJsonStr.length + leader.length,
        compressed  : leader === Leader.DEF_JSON
      })
      
      arData[index] = WireObject.getWireObject(arData[index])
    }

    return arData as [WireObject]
  }

  public async setNewKey(syncKey: string) {
    const arEncNewKey = this.strToUnit8Ar(atob(syncKey)),
          arNewKey    = new Uint8Array(await crypto.subtle.decrypt(SYM_ALGO, this.ci.syncKey, arEncNewKey))

    this.ci.syncKey = await crypto.subtle.importKey('raw', arNewKey, SYM_ALGO, true, ['encrypt', 'decrypt'])
  }

  private async ensureSyncKey() {

    if (!this.ci.syncKey) {
      this.ci.syncKey = await crypto.subtle.generateKey(SYM_ALGO, true, ['encrypt', 'decrypt'])
    // } else if (typeof this.ci.syncKey === 'string') {
    //   await this.decryptNewKey(this.ci.syncKey)
    }
  }

  async test() {
    const rawKey    = await crypto.subtle.exportKey('raw', this.ci.syncKey),
          encRawKey = new Uint8Array(await crypto.subtle.encrypt(SYM_ALGO, this.ci.syncKey, rawKey))
    
    console.log(encRawKey)
    const decRawKey = new Uint8Array(await crypto.subtle.decrypt(SYM_ALGO, this.ci.syncKey, encRawKey))
    console.log(decRawKey)
  }



  // async genKeyPair() {

  //   this.keyPair = await crypto.subtle.generateKey({
  //     name            : 'RSA-OAEP', 
  //     modulusLength   : 2048, 
  //     publicExponent  : new Uint8Array([0x01, 0x00, 0x01]), 
  //     hash            : {name: "SHA-1"}
  //   }, true, ['encrypt', 'decrypt'])
    
  //   this.PUB_KEY = this.logKey('publicKey', await crypto.subtle.exportKey('spki',  this.keyPair.publicKey))
  //   this.PRI_KEY = this.logKey('privateKey', await crypto.subtle.exportKey('pkcs8', this.keyPair.privateKey))
  // }

  // logKey(type: string, ab: ArrayBuffer) {
  //   console.log(type, ab.constructor.name, ab.byteLength)
  //   const s = String.fromCharCode(...(new Uint8Array(ab) as any)),
  //         bs = btoa(s)
  //   console.log(s.length, 'base64', bs.length, bs)
  //   return bs
  // }

  // async encrypt(str: string, pubKey ?: any) {

  //   const algo    = {name: 'RSA-OAEP', hash: {name: 'SHA-1'}},
  //         key     = pubKey || await crypto.subtle.importKey('spki', this.strToUnit8Ar(atob(this.PUB_KEY)), 
  //                   algo , true, ['encrypt']),
  //         encBuff = await crypto.subtle.encrypt(algo, key, this.strToUnit8Ar(str))

  //   return encBuff
  // }

  // async decrypt(encBuff, privKey ?: any) {

  //   const algo  = {name: 'RSA-OAEP', hash: {name: 'SHA-1'}},
  //         key   = privKey || await crypto.subtle.importKey('pkcs8', this.strToUnit8Ar(atob(this.PRI_KEY)), 
  //             algo , true, ['decrypt']),
  //         arOut = await crypto.subtle.decrypt(algo, key, encBuff)

  //   return String.fromCharCode(...(new Uint8Array(arOut)) as any)
  // }

  // async testWithNewKeys(s) {

  //   await this.genKeyPair()
  //   const str = s || 'this is a test',
  //         ab  = await this.encrypt(str, this.keyPair.publicKey),
  //         ret = await this.decrypt(ab, this.keyPair.privateKey)
    
  //   console.log('with new keys', ret === str, ret)
  //   console.log(this.arrayBufferToB64(ab))
  //   // await this.testStaticKeys(s)
  // }

  // async testStaticKeys(s) {
    
  //   const str = s || 'this is a test',
  //         ab  = await this.encrypt(str),
  //         ret = await this.decrypt(ab)
    
  //   return console.log('with static keys', ret === str, ret)
  // }

  // privateKeyToPem() {

  //   const MAGIC = 26,
  //         s = atob(this.PRI_KEY),
  //         ar = new Uint8Array(s.length - MAGIC)

  //   for (let i = MAGIC; i < s.length; i++) {
  //     ar[i - MAGIC] = s.charCodeAt(i)
  //   }

  //   let i = 0, str = '', b64 = btoa(String.fromCharCode(...ar as any))
  //   while (i < b64.length) {
  //     str += (b64.substr(i, 64) + '\n')
  //     i   += 64
  //   }

  //   return `-----BEGIN RSA PRIVATE KEY-----\n${str}-----END RSA PRIVATE KEY-----`
  // }

  strToUnit8Ar(binStr): Uint8Array {
    const cls:any     = Uint8Array
    return cls.from(binStr, c => c.charCodeAt(0))
  }

  arrayBufferToB64(ab: ArrayBuffer) {
    return btoa(String.fromCharCode(...new Uint8Array(ab) as any))
  }

  private extractShortCode(rc: RunContextBrowser, code: string) {

    rc.isAssert() && rc.assert(rc.getName(this), code.length <= 4)
    arShortCode = new Uint8Array(4)
    
    for (let index = 0; index < code.length; index++) {
      const str = code.charAt(index)
      rc.isAssert() && rc.assert(rc.getName(this), str.match(/[a-zA-Z0-9]/))
      arShortCode[index] = str.charCodeAt(0) - 40
    }
  }
      
  
  private extractUniqueId(rc: RunContextBrowser, id: string) {

    let ar = id.split('.').map(i => Number(i))

    if (ar.length > 1) {

      rc.isAssert() && rc.assert(rc.getName(this), ar.length === 3 && 
        !isNaN(ar[0]) && !isNaN(ar[1])  && !isNaN(ar[2]))

    } else {

      let num = Number(ar[0])
      rc.isAssert() && rc.assert(rc.getName(this), !isNaN(num) && num <= 999999)

      ar[2] = num % 100
      num   = Math.floor(num / 100)

      ar[1] = num % 100
      ar[0] = Math.floor(num / 100)

    }
    arUniqueId = Uint8Array.from(ar)
  }
    



}

