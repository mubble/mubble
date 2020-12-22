/*------------------------------------------------------------------------------
   About      : Credentials and Credential Registry
   
   Created on : Tue Feb 05 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

export interface ServerCredentials {
  id              : string             // Client / Server identifier
  syncHash        : string             // Client / Server public key
  host            : string             // Server host
  port            : number             // Server port
  permittedIps    : Array<string>      // Permitted IPs for client
  unsecured       : boolean
  permittedHosts  : Array<string>      // Permitted IPs for client
}

export interface CredentialRegistry {
  getCredential(id : string) : ServerCredentials | undefined
}

export interface AppCredentials {
  appShortName : string           // App Identifier
  permittedIps : Array<string>    // Client Permitted Ips
}

export interface AppRegistry {
  getCredential(appShortName : string) : AppCredentials | undefined
}