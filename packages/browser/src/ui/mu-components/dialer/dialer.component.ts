import { Component, 
         Inject, 
         Input,
         EventEmitter,
         Output,
         ElementRef,
         NgZone,
         ViewChild,
         Renderer2
       }                            from '@angular/core'
import { RunContextApp }            from 'framework'
import { TrackableScreen }          from '@mubble/browser'
import debounce                     from 'lodash/debounce'

const SCROLL_DELAY  = 250

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
  visibleElements   ?: number
  dialerCssClasses  ?: DialerCssClasses
  selectedItem      ?: DialerOptions
}

@Component({
  selector    : 'dialer',
  templateUrl : './dialer.component.html',
  styleUrls   : ['./dialer.component.scss']
})

export class DialerComponent {
  
  @ViewChild('scrollCont', { static: true })    scrollCont : ElementRef
  @ViewChild('contentHolder', { static: true }) contentHolder : ElementRef
  @ViewChild('dummyBottom', { static: true })    dummyBottom : ElementRef
  @ViewChild('dummyTop', { static: true })    dummyTop : ElementRef


  @Input() parentDiv      : ElementRef
  @Input() dialerParams   : DialerParams
  @Input() eventPropagte  : boolean  = false 
  @Input() screen         : TrackableScreen

  @Output() value : EventEmitter<DialerOptions> 

  viewPortItems : DialerOptions[]
  selectedItem  : DialerOptions

  private scrollActions : any
  private lastIndex     : number

  itemsHeight       : {[index: number]: number } = {} //caching each divs height to translate the scrollable div


  constructor(@Inject('RunContext') protected rc  : RunContextApp,
              private ngZone                      : NgZone,
              private renderer                    : Renderer2) { 
                
    this.value          = new EventEmitter<DialerOptions>()
    this.scrollActions  = debounce(this.hlNearestElem.bind(this), SCROLL_DELAY)
    window['dialer']    = this
  }

  ngOnInit() {

    const slicedItems = this.dialerParams.dialerOptions.slice(0)
    this.viewPortItems  = slicedItems
    this.selectedItem   = this.viewPortItems[0]
  }

  ngAfterViewInit() {

    const scrollElem        = this.scrollCont.nativeElement,
          viewPortChildren  = scrollElem.children,
          rect              = viewPortChildren[1].getBoundingClientRect(),
          width             = rect.width,
          height            = viewPortChildren[1].clientHeight
    
    this.contentHolder.nativeElement.style.height = `${height}px`
    this.contentHolder.nativeElement.style.width  = `${width}px`
    this.contentHolder.nativeElement.style.top    = `${height}px`

    const dummyHeight = scrollElem.scrollHeight - ((height * (this.dialerParams.dialerOptions.length - 1)))

    this.dummyTop.nativeElement.style.height    = `${height}px`
    this.dummyBottom.nativeElement.style.height = `${dummyHeight}px`

  }

  ngOnDestroy() {

  }

  /*=====================================================================
                              PRIVATE
  =====================================================================*/
  
  private hlNearestElem(autoScroll : boolean  = true, index ?: number) {
    
    const scrollElem      = this.scrollCont.nativeElement,
          scrollTop       = scrollElem.scrollTop,
          childHeight     = scrollElem.children[1].getBoundingClientRect().height,
          nearestElemIdx  = !autoScroll && typeof index !== undefined ? index  : Math.round(scrollTop/childHeight)

    this.ngZone.run(() => {
      
      const dummyBottomHeight = this.dummyBottom.nativeElement.clientHeight,
            dummyTopHeight    = this.dummyTop.nativeElement.clientHeight,
            totalHeight       = (this.dialerParams.dialerOptions.length - nearestElemIdx) * childHeight

      const currentTop = scrollElem.scrollHeight - dummyBottomHeight - dummyTopHeight - totalHeight
      scrollElem.scrollTop  = currentTop
      this.value.emit(this.dialerParams.dialerOptions[nearestElemIdx])
    })
  }

  // public updateItems() {

  //   const scrollElem        = this.scrollCont.nativeElement,
  //         scrollTop         = scrollElem.scrollTop,
  //         childHeight       = scrollElem.children[0].getBoundingClientRect().height,
  //         totalDialers      = this.dialerParams.dialerOptions.length

  //   let elementsScrolled  = Math.floor(scrollTop/childHeight)

  //   const scrollingUp = scrollTop > this.lastScrollPos
    
  //   console.log({elementsScrolled})

  //   if (scrollingUp) {

  //     if (elementsScrolled >= totalDialers) {
  //       elementsScrolled  = elementsScrolled % totalDialers
  //     }
  
  //     if (elementsScrolled !== this.previousEndIdx) {

  //       const diff =  elementsScrolled - this.previousEndIdx

  //       if (diff > 1) {
  //         const missedItems : DialerOptions[] = []
  //         for (let i = this.previousEndIdx ; i < elementsScrolled; i++) {
  //           missedItems.push(this.dialerParams.dialerOptions[i])
  //         }
  //       } else {
  //         const items = this.dialerParams.dialerOptions.slice(elementsScrolled, elementsScrolled + 1)
  //         this.viewPortItems.push(...items)
  //       }
       
  //       console.log({diff, previousEndIdx : this.previousEndIdx})

  //       this.previousEndIdx = elementsScrolled
        
  //     }
      
  //   } else {
  //     console.log('scrolling down')
  //     if (elementsScrolled > this.dialerParams.dialerOptions.length) return

  //     if (elementsScrolled >= totalDialers) {
  //       elementsScrolled  = elementsScrolled % totalDialers
  //     }

  //     const totalSctollPos  = childHeight * this.dialerParams.dialerOptions.length

  //     elementsScrolled = totalSctollPos - scrollTop

  //     if (elementsScrolled !== this.prevScrollDwn) {
  //       this.prevScrollDwn = elementsScrolled
  //       console.log('down', {elementsScrolled})
  //       // if (elementsScrolled)
  //       const items = this.dialerParams.dialerOptions.slice(-elementsScrolled - 1, -elementsScrolled)
  //       console.log('items', items)
  //       this.viewPortItems.unshift(...items)
  //     }

  //   }

  //   this.lastScrollPos  = scrollTop

  // }

  // private updateViewPortItems() {

  //   const scrollElem        = this.scrollCont.nativeElement,
  //         scrollTop         = scrollElem.scrollTop,
  //         childHeight       = scrollElem.children[0].getBoundingClientRect().height,
  //         containerHeight   = scrollElem.getBoundingClientRect().height,
  //         totalDialers      = this.dialerParams.dialerOptions.length,
  //         elementsVisible   = Math.ceil(containerHeight/childHeight)

  //   let end   = this.previousEndIdx
    
  //   const scrollingUp       = scrollTop > this.lastScrollPos,
  //         elementsScrolled  = Math.floor(scrollTop/childHeight),
  //         bottomElements    = this.viewPortItems.length - elementsScrolled

  //   console.log(scrollingUp)     

  //   if (scrollingUp && elementsScrolled < 5) {
  //     this.lastScrollPos  = scrollTop
  //     return
  //   }

  //   if (!scrollingUp && bottomElements < 6) {
  //     this.lastScrollPos  = scrollTop
  //     return
  //   }

  //   // if (scrollTop === 0 && this.lastScrollPos === 0) return
  
  //   if (scrollingUp) {
  //     this.previousEndIdx  += 3
  //   } else {
  //     this.previousEndIdx  -= 4
  //   }
    
  //   if (this.previousEndIdx > totalDialers) {
  //     this.previousEndIdx  = this.previousEndIdx % totalDialers
  //   } 

  //   if (this.previousEndIdx < -totalDialers) {
  //     this.previousEndIdx  = (this.previousEndIdx % totalDialers)
  //   }

  //   const viewElements  = this.previousEndIdx + ( scrollingUp ? this.viewPortItems.length : this.viewPortItems.length)

  //   const lastElements  : DialerOptions[] = [],
  //         slicedItems   : DialerOptions[] = []

  //   if (this.previousEndIdx < 0) {
  //     if (viewElements < 0) {
  //       lastElements.push(...this.dialerParams.dialerOptions.slice(this.previousEndIdx, viewElements))
  //     } else {
  //       lastElements.push(...this.dialerParams.dialerOptions.slice(this.previousEndIdx))
  //     }
  //   }

  //   if (lastElements.length < 10) {
  //     slicedItems.push(...this.dialerParams.dialerOptions.slice(Math.max(0, this.previousEndIdx), Math.max(0,viewElements)))
  //   }
       
  //   console.log({viewElements, elementsScrolled, scrollTop, bottomElements})
  //   console.log({scrollTop, lastScrollPos : this.lastScrollPos, scrollingUp : scrollTop > this.lastScrollPos, previousEndIdx : this.previousEndIdx})

  
  //   if (viewElements >= totalDialers) {

  //     const diff  = viewElements % totalDialers
  //     const initElements  = this.dialerParams.dialerOptions.slice(0, diff)

  //     if (scrollingUp) {
  //       slicedItems.push(...initElements)
  //     } else {
  //       slicedItems.unshift(...initElements)
  //     }
  //   }
    
  //   slicedItems.unshift(...lastElements)

  //   console.log({slicedItems})
    
  //   this.ngZone.run(() => {

  //     this.viewPortItems.push(...slicedItems)

  //     if (scrollingUp) {
  //       this.lastScrollPos  = end !== this.previousEndIdx ? (2 * childHeight) : scrollElem.scrollTop
  //       this.selectedItem   = this.viewPortItems[3]
  //     } else {
  //       this.lastScrollPos  = end !== this.previousEndIdx ?  (3 * childHeight) : (scrollElem.scrollHeight - scrollElem.scrollTop)
  //       this.selectedItem   = this.viewPortItems[7]
  //     }

  //     this.scrollActions()
  //   })

  // }

  private hightlightElem() {

    const scrollElem      = this.scrollCont.nativeElement,
          scrollTop       = scrollElem.scrollTop,
          childHeight     = scrollElem.children[1].clientHeight,
          nearestElemIdx  = Math.round(scrollTop/childHeight)

    this.ngZone.run(() => {

      if (nearestElemIdx !== this.lastIndex ) {
        this.rc.audio.play(this.rc.audio.SELECT)
        this.lastIndex  = nearestElemIdx
      }

      this.selectedItem = this.dialerParams.dialerOptions[nearestElemIdx]
    })

  }

  /*=====================================================================
                              HTML
  =====================================================================*/
  refreshList() {
    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        this.hightlightElem()
        this.scrollActions()
      })
    })
  }

  scrollToElem(index : number) {
    this.hlNearestElem(false, index)
  }

}
