import Hashids from 'hashids'

/*------------------------------------------------------------------------------
   About      : Utility class which makes use of HashIds for encrypting strings
                to hashes using a pre determined key. https://hashids.org/
   
   Created on : Thur May 24 2018
   Author     : Siddharth Garg
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

export class HashidConverter {

  static encodeString(key: string, str: string): string {

    const hashids = new Hashids(key)
    const charCodes = []
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i)
      charCodes.push(code)
    }

    return hashids.encode(charCodes)
  }

  static decodeHashids(key: string, hashid: string): string {

    const hashids = new Hashids(key)
    const charCodes = hashids.decode(hashid)

    let str = ''
    charCodes.forEach((charCode) => {
      str += String.fromCharCode(charCode)
    })

    return str
  }
}