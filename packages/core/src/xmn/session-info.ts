/*------------------------------------------------------------------------------
   About      : Represents private session info with the protocol.
                Not shared with api / client
   
   Created on : Wed Jan 02 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { XmnProvider }          from './xmn-core'

export interface SessionInfo {

  protocolVersion : string        // Example: 'v2'

  // provider for this connection (WebSocket, Http etc.)
  provider        : XmnProvider   // The protocol provider keeps it's custom data here
}
