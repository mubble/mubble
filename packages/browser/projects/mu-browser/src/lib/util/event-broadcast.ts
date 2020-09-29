/*------------------------------------------------------------------------------
   About        : <Write about the file here>
   
   Created on   : Sat Jul 15 2017
   Author       : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { RunContextBrowser, 
         LOG_LEVEL }          from '../rc-browser'

export const EVENT_PREFIX = 'mui-event'

export namespace EventSystem {

  export function broadcast(rc: RunContextBrowser, eventName: string, data ?: object) {

    data = data || {}

    const fullName = eventName.startsWith(EVENT_PREFIX) ? `${eventName}` : `${EVENT_PREFIX}-${eventName}`,
          nodeList = document.querySelectorAll('.' + fullName),
          event    = new CustomEvent(fullName, {detail: {data, rc}})

    for (let index = 0; index < nodeList.length; index++) {
      const element = nodeList[index]
      element.dispatchEvent(event)
    }

    window.dispatchEvent(event)

    rc.isStatus() && rc.status('EventSystem.broadcast', 'Completed broadcast of', 
      fullName, 'to', nodeList.length, 'dom element(s) and to global components via window')
  }

  export function eventToElements(rc: RunContextBrowser, eventName: string, 
                    elementClassName: string, data : object) {

    const fullName = eventName.startsWith(EVENT_PREFIX) ? `${eventName}` : `${EVENT_PREFIX}-${eventName}`,
          nodeList = document.querySelectorAll('.' + elementClassName),
          event    = new CustomEvent(fullName, {detail: {data, rc}})

    for (let index = 0; index < nodeList.length; index++) {
      const element = nodeList[index]
      element.dispatchEvent(event)
    }

    rc.isStatus() && rc.status('EventSystem.eventToElement', 'Completed event dispatch of', 
      fullName, 'to', nodeList.length, 'dom element(s)')
  }

  // Allows subscription of event for an element (when Angular syntax cannot be used)
  // UnSubscribe is automatic on element destroy
  export function elementSubscribe(element: HTMLElement, eventName: string, cb: any) {
    if (!eventName.startsWith(EVENT_PREFIX)) eventName = `${EVENT_PREFIX}-${eventName}`

    const classes = element.className.split(' ')
    if (classes.indexOf(eventName) === -1) {
      classes.push(eventName)
      element.className = classes.join(' ')
    } else {
      element.removeEventListener(eventName, cb)
    }
    element.addEventListener(eventName, cb)
  }

  // Any class whose object is globally alive in the app should use this 
  // since it does not unsubscribe for the events
  // UnSubscribe is ********* NEVER *********
  export function subscribe(eventName: string, cb: any, options ?: AddEventListenerOptions) {
    if (!eventName.startsWith(EVENT_PREFIX)) eventName = `${EVENT_PREFIX}-${eventName}`
    window.addEventListener(eventName, cb,options)
  }

  export function subscribeAll(eventNames : string[], cb : any) {
    eventNames.forEach((eventName) => {
      if (!eventName.startsWith(EVENT_PREFIX)) eventName = `${EVENT_PREFIX}-${eventName}`
        window.addEventListener(eventName, cb.bind(null , eventName))
    })
  }
}
