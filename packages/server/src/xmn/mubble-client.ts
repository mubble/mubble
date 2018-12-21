/*------------------------------------------------------------------------------
   About      : Mubble Client
   
   Created on : Tue Dec 18 2018
   Author     : Vishal Sinha
   
   Copyright (c) 2018 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import {
         Mubble,
         ConnectionInfo
       }                        from '@mubble/core'
import { RunContextServer }     from '../rc-server'
import * as https               from 'https'
import * as stream              from 'stream'

export namespace MubbleClient {

  const CLASS_NAME = 'MubbleClient'

  let selfId             : string,
      credentialRegistry : CredentialRegistry

  export type SyncCredentials = {
    id       : string     // Some identification of the client
    syncHash : string     // Client public key
    ip       : string     // Request IP
  }

  export interface CredentialRegistry {
    getCredential(id : string) : SyncCredentials
  }

  export enum ResultType {
    basic,    // default (only returns the output data)
    stream,   // Returns the output stream (without )
    complete  // Returns complete ResultStruct with 'output'
  }

  // Whenever there is failure or ResultType.complete
  export class ResultStruct {
    headers : Mubble.uObject<any>
    status  : number
    output  : Buffer | string | Mubble.uObject<any> | stream.Readable
    error   : null   | Error  = null
  }

  export function init(rc : RunContextServer, ci : ConnectionInfo, selfIdentity : string, registry : CredentialRegistry) {
    rc.isAssert() && rc.assert(CLASS_NAME, !selfId, 'Calling init twice!!!')

    selfId             = selfIdentity
    credentialRegistry = registry
  }

  export async function mubbleApi(rc            : RunContextServer, 
                                  apiName       : string,
                                  params        : Mubble.uObject<any>,
                                  host          : string,
                                  port          : number     = 443,
                                  resultType    : ResultType = ResultType.basic,
                                  syncHashPath ?: string) {

    
  }


}