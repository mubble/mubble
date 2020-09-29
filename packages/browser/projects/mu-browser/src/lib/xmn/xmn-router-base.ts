import { RunContextBrowser }  from '../rc-browser'
import { WireObject }         from '@mubble/core'

export interface XmnRouterBase {

  getPubKey() : Uint8Array
  getEncIV() : Uint8Array
  getMaxOpenSecs() : number
  canStrtLastReqTimer(rc: RunContextBrowser) : boolean
  providerReady()
  providerMessage(rc: RunContextBrowser, arData: WireObject[])
  providerFailed(errCode ?: string)
  getSessionTimeOutSecs(rc: RunContextBrowser)
  sessionTimedOut(rc: RunContextBrowser)
  runAlwaysAsSecure(rc: RunContextBrowser) : boolean  
}