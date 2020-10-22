/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Mon Jun 19 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { PerformanceMetrics }       from '../../util'
import { Renderer2 }                from '@angular/core'
import { DIRECTION, 
         THRESHOLD,
         GUTTER_WIDTH,
         AXIS,
         NailInterface, 
         NailConfig }               from './nail-interface'
import { RunContextBrowser, 
         LOG_LEVEL }                from '../../rc-browser'

let NEXT_SESSION_ID = 1

class TouchSession {

  ignore        : boolean
  startX        : number = -1 // indicates a uninitialized TouchSession
  startY        : number
  startTs       : number 

  lastX         : number
  lastY         : number

  ifNail        : NailInterface 

  axis          : AXIS
  perf          : PerformanceMetrics
  id            : number
  
  animateParam  : any[]
  animHandle    : number
  animSessionId : number

  constructor() {
    this.id = NEXT_SESSION_ID++
  }
}

// later these will be configured by looking at dom capabilities

const TOUCH_EVENT = {
  START   : 'touchstart',
  MOVE    : 'touchmove',
  END     : 'touchend',
  CANCEL  : 'touchcancel'
}

// const TOUCH_EVENT = {
//   START   : 'pointerdown',
//   MOVE    : 'pointermove',
//   END     : 'pointerup',
//   CANCEL  : 'pointercancel'
// }

const THRESHOLD_PIXELS      = 1
const MAX_THRESHOLD_PIXELS  = 10
const FAST_MIN_SPEED        = 2
const FAST_MAX_SPEED        = 8

export class Nail  {

  private config        : NailConfig
  private session       : TouchSession
  private pageWidth     : number
  private compName      : string
  private measure       : boolean = false
  private animateFn     : () => void
  
  private handlers: (()=>void)[] = []

  constructor(private rc            : RunContextBrowser,
              private element       : HTMLElement, 
              private appComponent  : NailInterface, 
              private renderer      : Renderer2, 
                      config        : NailConfig) {

    rc.setupLogger(this, 'Nail', LOG_LEVEL.STATUS)
    this.compName = appComponent.constructor ? appComponent.constructor.name : '?'

    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), config.axisX || config.axisY, 
      'Nail needs to be configured for at least one axes')
    
    this.setConfig(config)
    this.pageWidth = document.body.clientWidth

    const panEventHandler = this.onNailEvent.bind(this)

    this.handlers.push(renderer.listen(element, TOUCH_EVENT.START, panEventHandler),
      renderer.listen(element, TOUCH_EVENT.MOVE, panEventHandler),
      renderer.listen(element, TOUCH_EVENT.END, panEventHandler),
      renderer.listen(element, TOUCH_EVENT.CANCEL, panEventHandler))

    this.animateFn = this.onRunAnimation.bind(this)
      
    rc.isStatus() && rc.status(rc.getName(this), 'Nail events are being monitored for', 
      this.compName, 'with config', config)
  }

  public changeConfig(config) {
    this.setConfig(config)
    // See if we can create a DOM Event object ???? TODO
    if (this.session) this.panEndEvent({type: 'simulatedPanEnd'})
  }

  public requestAnimate(...animateParam: any[]) {
    if (this.session) {
      this.session.animateParam = animateParam
      if (this.session.animHandle) window.cancelAnimationFrame(this.session.animHandle)
      this.session.animHandle     = window.requestAnimationFrame(this.animateFn)
      this.session.animSessionId  = this.session.id
    }
  }

  public setDirections(disallowLeft: boolean, disallowRight: boolean) {
    this.config.disallowLeft  = disallowLeft
    this.config.disallowRight = disallowRight
  }

  private setConfig(config) {

    config.threshold   = config.threshold || THRESHOLD
    config.gutterWidth = config.gutterWidth || GUTTER_WIDTH
    
    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), config.threshold <= 1, 
      'Threshold cannot be more than 1')

    this.config = config
  }

  onNailEvent(event:any) {

    const session = this.session,
          config = this.config

    // console.log(event.type, 'with',  event.touches.length, 'touches')
    // no axis is being monitored
    if (!(this.config.axisX || this.config.axisY)) return

    if (event.type === TOUCH_EVENT.START) {

      if (event.touches && event.touches.length !== 1) return
      if (this.session) this.panEndEvent({type: 'simulatedPanEnd'})
        
      this.session        = new TouchSession()
      this.extractEventAttr(event)
      
      if (this.measure) {
        this.session.perf = new PerformanceMetrics('nail-' + this.compName)
      }

      if (this.appComponent.onTouchStart) this.appComponent.onTouchStart(event)

      this.rc.isDebug() && this.rc.debug(this.rc.getName(this), this.compName, event.type,
        'received')

    } else if (event.type === TOUCH_EVENT.MOVE) {

      if (!session || session.ignore) return
      if (event.touches && event.touches.length !== 1) {
        session.ignore = true
        return
      }
      this.extractEventAttr(event)

      const deltaX = session.lastX - session.startX,
            deltaY = session.lastY - session.startY

      if (!session.axis) { // we try to find if we can establish the direction of movement
        if (this.measure) this.session.perf.startStep('ascertain')
        const ascertained = this.ascertainDirection(event, deltaX, deltaY)
        if (this.measure) this.session.perf.endStep('ascertain')
        if (!ascertained) return
      }

      if (this.measure) this.session.perf.startStep(TOUCH_EVENT.MOVE)
      event.axis   = session.axis
        
      if (session.axis === AXIS.X) {
        event.deltaX    = deltaX
        event.deltaY    = 0
        event.direction = deltaX > 0 ? DIRECTION.RIGHT : DIRECTION.LEFT
      } else {
        event.deltaX    = 0
        event.deltaY    = deltaY
        event.direction = deltaY > 0 ? DIRECTION.DOWN : DIRECTION.UP
      }

      if (this.measure) this.session.perf.startStep('onPanMove')
      const consumed =  session.ifNail.onPanMove(event)
      if (this.measure) this.session.perf.endStep('onPanMove')

      if (this.measure) this.session.perf.endStep(TOUCH_EVENT.MOVE)
      if (consumed) {
        this.rc.isDebug() && this.rc.debug(this.rc.getName(this), this.compName, event.type,
          'consumed event', {deltaX, deltaY, eventY: event.deltaY, session})
          
        event.preventDefault()
        event.stopPropagation()
        
        return true

      } else {
        this.rc.isDebug() && this.rc.debug(this.rc.getName(this), this.compName, event.type,
          'ignored event', {deltaX, deltaY, eventY: event.deltaY, session})
      }

    } else { // end or cancel event

      this.rc.isDebug() && this.rc.debug(this.rc.getName(this), this.compName, event.type,
        'received')

      if (this.session) this.panEndEvent(event)
    }
  }

  private panEndEvent(event) {

    if (this.measure) this.session.perf.startStep(event.type)

    const session = this.session
    // If we have not ascertained

    if (session.axis) {

      event.axis = session.axis

      const deltaMs = Date.now() - session.startTs

      event.deltaY = session.lastY - session.startY
      event.deltaX = session.lastX - session.startX

      const change = Math.abs(session.axis === AXIS.X ? event.deltaX : event.deltaY),
            speed  = deltaMs ? (change * 1000 / (deltaMs * deltaMs)) : 0

      let quickRatio    = (speed - FAST_MIN_SPEED) / (FAST_MAX_SPEED - FAST_MIN_SPEED)
      quickRatio        = quickRatio < 0 ? 0 : (quickRatio > 0.5 ? 0.5 : quickRatio)
      event.quickRatio  = quickRatio
      event.speed       = speed
      event.timeTaken   = deltaMs

      // this.rc.isWarn() && this.rc.warn(this.rc.getName(this), {change, deltaMs, speed, 
      //   quickRatio, FAST_MIN_SPEED, FAST_MAX_SPEED})

      if (this.measure) this.session.perf.startStep('onPanEnd')
      session.ifNail.onPanEnd(event)
      if (this.measure) this.session.perf.endStep('onPanEnd')
    } else if (this.appComponent.onTouchEnd) {
      this.appComponent.onTouchEnd(event)
    }

    if (this.measure) this.session.perf.endStep(event.type)
    if (this.measure) this.session.perf.finish()
    this.session = null
  }

  private extractEventAttr(event: any): void {

    const session = this.session

    const touch     = event.touches[0]
    session.lastX   = touch.pageX
    session.lastY   = touch.pageY

    if (session.startX === -1) {
      session.startX  = session.lastX
      session.startY  = session.lastY
      session.startTs = Date.now()
    }
  }

  // figure out direction of movement
  private ascertainDirection(event: any, deltaX: number, deltaY: number) {

    const session = this.session,
          config  = this.config,
          posDx   = Math.abs(deltaX),
          posDy   = Math.abs(deltaY)

    let axis = 0
    if (posDx >= THRESHOLD_PIXELS && (config.threshold > (posDy / posDx))) {
      axis = AXIS.X
    } else if (Math.abs(posDy) >= THRESHOLD_PIXELS && (config.threshold > (posDx / posDy))) {
      axis = AXIS.Y
    } else if (posDx > MAX_THRESHOLD_PIXELS) {
      axis = AXIS.X
    } else if (posDy > MAX_THRESHOLD_PIXELS) {
      axis = AXIS.Y
    }

    if (!axis) return false

    if (!((axis === AXIS.X && config.axisX) || (axis === AXIS.Y && config.axisY))) {
      this.rc.isStatus() && this.rc.status(this.rc.getName(this), this.compName, 
        'Cancelling ascertain as we locked incorrect axis')
      session.ignore = true
      return
    }

    this.rc.isDebug() && this.rc.debug(this.rc.getName(this), this.compName, event.type,
    'Ascertained', axis, {deltaX, deltaY})
    session.axis   = axis
    
    if (((session.startX < config.gutterWidth) || (deltaX > 0 && config.disallowRight)) && config.gutterLeft) {
      session.ifNail = config.gutterLeft
    } else if (((session.startX > (this.pageWidth - config.gutterWidth)) || (deltaX < 0 && config.disallowLeft)) && config.gutterRight) {
      session.ifNail = config.gutterRight
    } else {
      session.ifNail = this.appComponent
    }

    event.axis    = session.axis
    event.deltaX  = deltaX
    event.deltaY  = deltaY
    if (this.session.ifNail.onPanStart) {
      if (this.measure) this.session.perf.startStep('onPanStart')
      this.session.ifNail.onPanStart(event)
      if (this.measure) this.session.perf.endStep('onPanStart')
    }

    return true
  }

  private onRunAnimation() {
    
    const session = this.session
    if (!session) return

    this.session.animHandle = null

    if (session.ignore || session.animSessionId !== session.id) return
    session.ifNail.onPanAnimate(...session.animateParam)
  }
  
  public destroy() {

    for (const handler of this.handlers) {
      handler()
    }
    this.handlers = []
    this.config   = null
    this.session  = null
  }

}