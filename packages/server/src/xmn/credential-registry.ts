/*------------------------------------------------------------------------------
   About      : Sync Credentials and Credential Registry
   
   Created on : Tue Feb 05 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

export interface SyncCredentials {
  id            : string             // Client / Server identifier
  syncHash      : string             // Client / Server public key
  host          : string             // Server host
  port          : number             // Server port
  permittedIps  : Array<string>      // Permitted IPs for client
  nodeServer   ?: boolean
}

export interface CredentialRegistry {
  getCredential(id : string) : SyncCredentials
}