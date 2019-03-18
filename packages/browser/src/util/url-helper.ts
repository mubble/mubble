import { HashidConverter } from './hashid-converter';

/*------------------------------------------------------------------------------
   About      : Url sanitizer
   
   Created on : Sat Nov 03 2018
   Author     : Sid
   
   Copyright (c) 2018 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

export class UrlHelper {

  static getUrlParams(genericUrl: string) {

    const idx = genericUrl.indexOf('?')
    if (idx === -1) return null

    const url = genericUrl.substring(idx+1)
    const queries = url.split('&')
    const params = {}

    for (let i = 0; i < queries.length; i++) {
      const split = queries[i].split('=')
      params[split[0]] = split[1]
    }

    return params
  }

  static decodeStringFromHashids(key: string, hashids: string): string {
    return HashidConverter.decodeHashids(key, hashids)
  }

}