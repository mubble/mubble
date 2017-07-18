/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Sat Jul 15 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { RunContextBrowser, 
         LOG_LEVEL }          from '..'

export const EVENT_PREFIX = 'mui-event'

export namespace EventSystem {

  export function broadcast(rc: RunContextBrowser, eventName: string, data ?: object) {

    data = data || {}

    const fullName = `${EVENT_PREFIX}-${eventName}`,
          nodeList = document.querySelectorAll('.' + fullName),
          event    = new CustomEvent(fullName, {detail: {data, rc}})

    for (let index = 0; index < nodeList.length; index++) {
      const element = nodeList[index]
      element.dispatchEvent(event)
    }

    window.dispatchEvent(event)

    rc.isStatus() && rc.status(rc.getName(this), 'Completed broadcast of', 
      fullName, 'to', nodeList.length, 'element(s) and window')
  }

  // Use it only in global context
  export function subscribe(eventName: string, cb: any) {
    if (!eventName.startsWith(EVENT_PREFIX)) eventName = `${EVENT_PREFIX}-${eventName}`
    window.addEventListener(eventName, cb)
  }
}
