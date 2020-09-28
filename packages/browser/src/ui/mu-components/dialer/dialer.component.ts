import { Component, 
         Inject, 
         Input,
         EventEmitter,
         Output,
         ElementRef,
         NgZone,
         ViewChild,
         HostListener,
         Renderer2
       }                            from '@angular/core'
import { RunContextBrowser }          from '../../../rc-browser'
import { Nail, 
         NailInterface 
       }                              from '../../nail'
import { MultiStepValue, 
         DomHelper 
       }                            from '../../../util'
       

const ANIM_TRANSITION   = 600
const KEY_ANIM_TRANS    = 200
const EVENT_TIME_TAKEN  = 250   

export interface DialerOptions  {
  id         : string | number
  value      : string | number
}

export interface DialerCssClasses {
  bgColor       ?: string
  activeColor   ?: string
  inActiveColor ?: string
}

export interface DialerParams {
  dialerOptions      : DialerOptions[]
  isCircular        ?: boolean
  highlightPos      ?: number
  dialerCssClasses  ?: DialerCssClasses
  selectedItem      ?: DialerOptions
}

@Component({
  selector    : 'dialer',
  templateUrl : './dialer.component.html',
  styleUrls   : ['./dialer.component.scss']
})

export class DialerComponent implements NailInterface {

  @HostListener('keydown', ['$event']) onHostKeyup(event : KeyboardEvent) {
    this.onKeyDown(event)
  }
  
  @ViewChild('scrollCont',    { static: true }) scrollCont    : ElementRef
  @ViewChild('contentHolder', { static: true }) contentHolder : ElementRef


  @Input() parentDiv      : ElementRef
  @Input() dialerParams   : DialerParams
  @Input() eventPropagte  : boolean  = false 
  // @Input() screen         : TrackableScreen

  @Output() value : EventEmitter<DialerOptions> 

  viewPortItems : DialerOptions[]
  selectedItem  : DialerOptions

  private nail          : Nail
  private multiStepVal  : MultiStepValue
  private lastIndex     : number
  private sound         : any

  constructor(@Inject('RunContext') protected rc  : RunContextBrowser,
              private renderer                    : Renderer2,
              private ngZone                      : NgZone) { 
                
    this.value          = new EventEmitter<DialerOptions>()
    // window['dialer']    = this

    // user howler for sound if being implemented in mobile 
    //( https://cdnjs.cloudflare.com/ajax/libs/howler/2.1.2/howler.core.min.js)

    // this.sound = new (window as any).Howl({
    //   src     : ['sounds/select.mp3'],
    //   volume  : 0.15

    // });
    
  }

  ngOnInit() {
    
    const slicedItems   = this.dialerParams.dialerOptions.slice(0)
    this.viewPortItems  = slicedItems
    this.selectedItem   = this.dialerParams.selectedItem || this.viewPortItems[0]
  }

  ngAfterViewInit() {

    const scrollElem        = this.scrollCont.nativeElement,
          viewPortChildren  = scrollElem.children,
          rect              = viewPortChildren[1].getBoundingClientRect(),
          width             = rect.width

    this.contentHolder.nativeElement.style.height = `${rect.height}px`
    this.contentHolder.nativeElement.style.width  = `${width}px`
    this.contentHolder.nativeElement.style.top    = this.dialerParams.highlightPos 
                                                    ? `(${this.dialerParams.highlightPos} * ${rect.height})px`
                                                    : `${rect.height}px`
    this.scrollCont.nativeElement.style.top       = this.dialerParams.highlightPos 
                                                    ? `(${this.dialerParams.highlightPos} * ${rect.height})px`
                                                    : `${rect.height}px`

    this.nail           = new Nail(this.rc, this.scrollCont.nativeElement, this, this.renderer, { axisX : false, axisY : true})
    this.multiStepVal   = new MultiStepValue(0, rect.height, this.dialerParams.dialerOptions.length, false, true)

  }

  ngOnDestroy() {

  }

  /*=====================================================================
                              PRIVATE
  =====================================================================*/

  private onKeyDown(event : KeyboardEvent) {

    const scrollElem        = this.scrollCont.nativeElement,
          viewPortChildren  = scrollElem.children,
          rect              = viewPortChildren[1].getBoundingClientRect(),
          lastIndex         = this.lastIndex
          
    if (event.which === 38) {
      this.multiStepVal.final(rect.height, 0.2)
    } else if (event.which === 40) {
      this.multiStepVal.final(-rect.height, 0.2)
    } else {
      return
    }

    event.stopImmediatePropagation()
    event.stopPropagation()
    event.preventDefault()

    const currentIndex  = this.multiStepVal.currentIndex

    if (currentIndex === lastIndex) return

    this.scrollCont.nativeElement.style.transition  = `${KEY_ANIM_TRANS}ms`
    DomHelper.setTransform(this.scrollCont.nativeElement, 0, -this.multiStepVal.currentValue, 0)
    this.lastIndex    = this.multiStepVal.currentIndex
    this.selectedItem = this.dialerParams.dialerOptions[this.lastIndex]
    // this.rc.audio.play(this.rc.audio.SELECT)
    if (this.sound) this.sound.play()
    if (this.eventPropagte) this.value.emit(this.selectedItem)

  }

  /*=====================================================================
                              CALLBACKS
  =====================================================================*/
  onPanStart() {
    this.scrollCont.nativeElement.style.transition  = 'none'
  }

  onPanMove(event : any) {

    this.ngZone.runOutsideAngular(() => {

      const scrollElem        = this.scrollCont.nativeElement,
            viewPortChildren  = scrollElem.children,
            rect              = viewPortChildren[1].getBoundingClientRect(),
            deltaY            = event.deltaY,
            value             = this.multiStepVal.transition(deltaY),
            lastIndex         = this.lastIndex

      const newIndex  = Math.round(value/rect.height)

      if (lastIndex !== newIndex) {
        if (this.sound) this.sound.play()
        this.lastIndex  = newIndex
      }

      this.nail.requestAnimate(value)
      this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
      `onPanMove ${JSON.stringify({event, lastIndex : this.lastIndex})}`)

      this.selectedItem = this.dialerParams.dialerOptions[this.lastIndex]

    })

    
    return true
  }

  onPanAnimate(value : number) {
    this.ngZone.run(() => {
      DomHelper.setTransform(this.scrollCont.nativeElement, 0, -value, 0) 
    })
  }

  onPanEnd(event : any) {

    this.ngZone.runOutsideAngular(() => {
      
      const deltaY            = event.deltaY,
            scrollElem        = this.scrollCont.nativeElement,
            viewPortChildren  = scrollElem.children,
            rect              = viewPortChildren[1].getBoundingClientRect(),
            value             = this.multiStepVal.transition(deltaY)
   
      const currentIndex  = this.multiStepVal.currentIndex

      this.multiStepVal.final(deltaY, event.speed, event.quickRatio)

      const latestIndex = this.multiStepVal.currentIndex
      const newIndex  = Math.round(value/rect.height)

      this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
      `onPanEnd ${JSON.stringify({event, lastIndex : this.lastIndex, newIndex, currentIndex, latestIndex})}`)

      if (currentIndex === latestIndex) return

      this.scrollCont.nativeElement.style.transition  = `${ANIM_TRANSITION}ms`
      const totalDisplacement = Math.abs((event.timeTaken < EVENT_TIME_TAKEN ? currentIndex : newIndex ) - latestIndex) || 1

      this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
      `totalDisplacement ${JSON.stringify(totalDisplacement)}`)

      const interval  = setInterval(() => {
        if (this.sound) this.sound.play()
      }, ANIM_TRANSITION/totalDisplacement)

      if (latestIndex >= currentIndex) {

        for (let i = currentIndex ; i <= latestIndex; i = i + 0.25) {
          DomHelper.setTransform(this.scrollCont.nativeElement, 0, -rect.height * i, 0)
        }

      } else {

        for (let i = latestIndex; i < currentIndex; i = i + 0.25) {
          DomHelper.setTransform(this.scrollCont.nativeElement, 0, rect.height * i, 0)
        }
      }

      setTimeout(() => {
        clearInterval(interval)
      }, ANIM_TRANSITION)
    
    })

    this.ngZone.run(() => {
      
      DomHelper.setTransform(this.scrollCont.nativeElement, 0, -this.multiStepVal.currentValue, 0)
    
      this.lastIndex    = this.multiStepVal.currentIndex
      this.selectedItem = this.dialerParams.dialerOptions[this.lastIndex]
      
      if (this.eventPropagte) this.value.emit(this.selectedItem)

    })
  }

  /*=====================================================================
                              UTILS
  =====================================================================*/
  getSelectedItem() {
    this.value.emit(this.selectedItem)
  }

  scrollToElem(index : number) {

    if (index === this.multiStepVal.currentIndex) return

    const scrollElem        = this.scrollCont.nativeElement,
          viewPortChildren  = scrollElem.children,
          rect              = viewPortChildren[1].getBoundingClientRect()

    if (index > this.multiStepVal.currentIndex) {
      this.multiStepVal.final(-rect.height, 0.2)
    } else {
      this.multiStepVal.final(rect.height, 0.2)
    }

    this.scrollCont.nativeElement.style.transition  = `${KEY_ANIM_TRANS}ms`
    DomHelper.setTransform(this.scrollCont.nativeElement, 0, -this.multiStepVal.currentValue, 0)

    this.lastIndex    = this.multiStepVal.currentIndex
    this.selectedItem = this.dialerParams.dialerOptions[this.lastIndex]

    // this.rc.audio.play(this.rc.audio.SELECT)
    if (this.sound) this.sound.play()
    if (this.eventPropagte) this.value.emit(this.selectedItem)

  }

}
