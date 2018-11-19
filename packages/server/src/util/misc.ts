/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Tue May 22 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import * as os from 'os'

export namespace Misc {

  export function getLocalIp() {

    const ifaces  = os.networkInterfaces(),
          ifNames = Object.keys(ifaces)

    for (const ifName of ifNames) {

      for (const iface of ifaces[ifName]) {
        // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
        if ('IPv4' !== iface.family || iface.internal !== false) continue
        return iface.address
    
        // if (alias >= 1) {
        //   // this single interface has multiple ipv4 addresses
        //   console.log(ifName + ':' + alias, iface.address)
        // } else {
        //   // this interface has only one ipv4 adress
        //   console.log(ifName, iface.address)
        // }
        // ++alias
      }
    }
    return '127.0.0.1'
  }

}