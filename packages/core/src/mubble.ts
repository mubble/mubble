/*------------------------------------------------------------------------------
   About      : Common stuff for all Mubble Projects
   
   Created on : Wed Jul 19 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

export namespace Mubble {

  export type uObject<T> = Object & {[name: string]: T}

  export const Lang = {
    English : 'en',
    Hindi   : 'hi',
    Kannada : 'kn'
  }

  export class uError extends Error {
    constructor(public code: string, msg: string) {
        super(msg)
    }
}
}