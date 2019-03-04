/*------------------------------------------------------------------------------

   About      : Infinite scroll
   
   Created on : Mon Jul 23 2018
   Author     : Aditya Baddur
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { Component, 
         Input,
         Output,
         EventEmitter,
         ViewChild,
         ElementRef,
         NgZone,
         Renderer2
       }                from '@angular/core'
import { DomHelper }    from '@mubble/browser/util/dom-helper'
import { Mubble }       from '@mubble/core'
 
const SCROLL_EVENT  = 'scroll'

interface ListItem {
  type    : string
  params  : Mubble.uObject<any>
}

@Component({
  selector    : 'infinite-scroll',
  templateUrl : './infinite-scroll.component.html',
  styleUrls   : ['./infinite-scroll.component.scss']
})

export class InfiniteScrollComponent {

  @Input() items            : ListItem[]  = []         //Items that have to be loaded into html in chunks
  @Input() upperBufferCount : number  = 50  //min no. of elements that should be loaded at the top before we start removing items
  @Input() lowerBufferCount : number  = 10  //min no. of elements that should be loaded at the bottom

  @Output() listEnd       : EventEmitter<number>  = new EventEmitter<number>() // list ended event to the parent 
  @Output() activeElement : EventEmitter<number>  = new EventEmitter<number>() // active element event to the parent
 
  @ViewChild('scrollCont')    scrollCont    : ElementRef // container inside which divs are manipulated 
  @ViewChild('contentHolder') contentHolder : ElementRef // container holding scrollable div

  viewPortItems     : any[]   = []  // these are the items that are loaded in html

  //the indices which slices the main items list
  previousStartIdx  : number  = 0   
  previousEndIdx    : number  = -1 

  itemsHeight       : {[index: number]: number } = {} //caching each divs height to translate the scrollable div
  
  private translateY    : number  = 0
  private scrollHandler : () => void

  private lastScrolledTop     : number  = 0
  private currActiveElemIndex : number  = 0
  private lastActiveElemIndex : number  = -1

  constructor(private element   : ElementRef,
              private ngZone    : NgZone,
              private renderer  : Renderer2) { }

  ngOnInit() {
    this.viewPortItems  = this.items.slice(this.previousStartIdx, this.lowerBufferCount)
    this.scrollHandler  = this.renderer.listen(this.element.nativeElement, SCROLL_EVENT, this.refreshList.bind(this))
  }

  ngOnChanges() {
    this.refreshList()
  }

  ngAfterViewInit() {
    this.setInitHolderHeight() 
  }

  ngOnDestroy() {
    if (this.scrollHandler) {
      this.scrollHandler()
    }
  }

  /*=====================================================================
                              PRIVATE METHODS  												
  =====================================================================*/

  private setInitHolderHeight() {
    const viewPortChildren  = this.scrollCont.nativeElement.children,
          holderHeight      = this.calculateHeight()/viewPortChildren.length * this.viewPortItems.length

    this.renderer.setStyle(this.contentHolder.nativeElement, 'height', `${holderHeight}px`)
  }

  private calculateHeight() {
    const viewPortChildren = this.scrollCont.nativeElement.children
    let totalHeight = 0
    for (let i = 0; i < viewPortChildren.length; i++) {
      const height = viewPortChildren[i].getBoundingClientRect().height
      totalHeight += height
    }
    return Math.ceil(totalHeight)
  }

  private cacheViewedItemsHeight() {
    const viewPortChildren = this.scrollCont.nativeElement.children
    let i = this.previousStartIdx
    for (const child of viewPortChildren) {
      const height        = child.getBoundingClientRect().height
      this.itemsHeight[i] = height
      i++
    }
  }

  private updateViewPortItems() {
    
    const viewPortChildren    = this.scrollCont.nativeElement.children,
          viewPortItemsHeight = this.calculateHeight(),
          averageHeight       = Math.ceil(viewPortItemsHeight/ viewPortChildren.length),
          scrollTop           = this.element.nativeElement.scrollTop,
          containerHeight     = this.element.nativeElement.getBoundingClientRect().height

    this.cacheViewedItemsHeight()

    let start = this.previousStartIdx,
        end   = this.previousEndIdx

    const elementsScrolled  = Math.ceil(scrollTop/averageHeight),
          elementsVisible   = Math.ceil(containerHeight/averageHeight) 

    start = elementsScrolled - this.upperBufferCount + elementsVisible
    end   = elementsScrolled + elementsVisible + this.lowerBufferCount

    start = Math.max(0, start)
    end   = Math.min(this.items.length, end >= 0 ? end : Infinity )

    let height  = 0
    
    if (start > this.previousStartIdx) {
      //scrolling down
      for (let i = this.previousStartIdx; i < start ; i++) {
        height += this.itemsHeight[i] || averageHeight
      }
      this.translateY += height
    } else if (start < this.previousStartIdx) {
      //scrolling up
      for (let i = start; i < this.previousStartIdx; i++) {
        height += this.itemsHeight[i] || averageHeight
      }
      this.translateY -= height
    }

    const currentHolderHeight = Math.ceil(viewPortItemsHeight + this.translateY)

    const holderHeight  = Math.ceil((averageHeight * (this.items.length - end) + currentHolderHeight))
    this.renderer.setStyle(this.contentHolder.nativeElement, 'height', `${holderHeight}px`)

    DomHelper.setTransform(this.scrollCont.nativeElement, 0, this.translateY, 0)

    if (start !== this.previousStartIdx || end !== this.previousEndIdx) {

      this.ngZone.run(() => {

        this.previousStartIdx = start
        this.previousEndIdx   = end

        this.viewPortItems = this.items.slice(start, end)

        if (this.previousEndIdx === this.items.length) this.listEnd.emit(this.items.length)
        
      })
    }
  }

  private scrollTo(index : number, highlight : boolean = false) {
    let totalHeight = 0
    for (let i = 0; i < index; i++) {
      totalHeight += this.itemsHeight[i]
    }
    this.element.nativeElement.scrollTop  = totalHeight
    if (highlight) {
      
      //TODO: add bg color and delay
    }
    this.refreshList()
  }

  private isElementInViewPort(element) {
    const parentElem      = this.element.nativeElement,
          viewPortTop     = parentElem.scrollTop,
          viewPortBottom  = viewPortTop + parentElem.clientHeight,
          elemTop         = element.offsetTop + (0.1 * element.clientHeight),
          elemBottom      = element.offsetTop + (0.9 * element.clientHeight)

    return (elemBottom <= viewPortBottom) && (elemTop >= viewPortTop)
  }

  /*
    if scrolling down, the first visible element from top is currentActive element else 
    the last visible element is currentActive element 
  */
  private updateCurrActiveElemIdx() {
    const parentElem        = this.element.nativeElement,
          viewPortElements  = parentElem.children[1].children,
          scrolledDown      = parentElem.scrollTop > this.lastScrolledTop
    
    for (let index = 0 ; index < viewPortElements.length ; index++) {

      const elementVisible  = this.isElementInViewPort(viewPortElements[index]),
            anchorId        = this.viewPortItems[index].anchorId || null

      if (elementVisible && anchorId) {
        this.currActiveElemIndex  = this.previousStartIdx + index
        if (scrolledDown) break
      }
    }
    this.lastScrolledTop  = parentElem.scrollTop 
  }

  /*=====================================================================
                                    UTILS  															
  =====================================================================*/
  scrollToTop() {
    this.element.nativeElement.scrollTop  = 0
    this.refreshList()
  }

  scrollToItem(index : number, highlight : boolean = false) {
    if (this.itemsHeight[index]) {
      this.scrollTo(index, highlight)
    } else {
      if (index < this.items.length) {
        this.viewPortItems = this.items.slice(0, index + this.lowerBufferCount)
        this.element.nativeElement.scrollTop = 1
        setTimeout(() => {
          this.scrollTo(index, highlight)
        },0)
      }
    }
  }

  getScrollableElement() {
    return this.element
  }

  // getSkippedElementsId() : string[] {
  //   const skippedElementsId = []

  //   if (this.lastActiveElemIndex > this.currActiveElemIndex) {
  //     for (let i = this.currActiveElemIndex; i < this.lastActiveElemIndex; i++) {
  //       const anchorId = this.items[i].anchorId || null
  //       if (anchorId) skippedElementsId.push(anchorId)
  //     }
  //   } else if (this.lastActiveElemIndex < this.currActiveElemIndex) {
  //     for (let i = this.lastActiveElemIndex; i < this.currActiveElemIndex; i++) {
  //       const anchorId = this.items[i].anchorId || null
  //       if (anchorId) skippedElementsId.push(anchorId)
  //     }
  //   }
  //   return skippedElementsId
  // }


  getViewedElementsId() : string[] {
    const parentElem        = this.element.nativeElement,
          viewPortElements  = parentElem.children[1].children,
          viewedElementsIds = []

    this.lastActiveElemIndex  = this.currActiveElemIndex

    for (let index = 0 ; index < viewPortElements.length ; index++) {

      const elementVisible  = this.isElementInViewPort(viewPortElements[index]),
            anchorId        = this.viewPortItems[index].anchorId || null

      if (elementVisible && anchorId) {
        viewedElementsIds.push(anchorId)
      }
    }
    this.updateCurrActiveElemIdx()
    return viewedElementsIds
  }


  getActiveElementId(firstElem : boolean  = false) : string {
    const parentElem        = this.element.nativeElement,
          viewPortElements  = parentElem.children[1].children
          
    let activeElementId

    for (let index = 0 ; index < viewPortElements.length ; index++) {

      const elementVisible  = this.isElementInViewPort(viewPortElements[index]),
            anchorId        = this.viewPortItems[index].anchorId || null

      if (elementVisible && anchorId) {
        activeElementId = anchorId
      }
    }
    return activeElementId
  }

  /*=====================================================================
                              HTML FUNCTIONS  												
  =====================================================================*/
  refreshList() {
    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        this.updateViewPortItems()
      })
    })
  }
  
}
