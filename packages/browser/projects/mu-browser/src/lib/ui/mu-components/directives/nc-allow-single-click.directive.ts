/*------------------------------------------------------------------------------
   About      : This directive prevents accidental double clicking on elements.
                It disables the click events on an element for ALLOW_CLICK_DELAY 
                milliseconds by default or you can pass it a number value in
                milliseconds.
   
   Created on : Thu Nov 06 2017
   Author     : Pranjal Dubey
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { Directive,
         HostListener,
         EventEmitter,
         Input, 
         Output, 
         HostBinding,
         Inject,
         ElementRef,
         Renderer2
       }                      from '@angular/core'
import { RunContextBrowser }  from '../../../rc-browser'

const ALLOW_CLICK_DELAY  = 1000
const BUTTON  = 'BUTTON'

@Directive({
  selector: '[ncAllowSingleClick]'
})
export class NcAllowSingleClickDirective {
  
  @Input('ncPreventDoubleClick') allowClickDelay: number
  @Input('onHoverBackgroundColor') onHoverColor   : string
  
  @Output() ncClick : EventEmitter<any> = new EventEmitter<any>()
  
  private clickEnabled: boolean = true
  private originialColor  : string  = ''

  constructor(@Inject('RunContext') protected rc  : RunContextBrowser,
              private element                     : ElementRef,
              private renderer                    : Renderer2) {
  
  }

  onMouseOver() {
    if (this.element.nativeElement.tagName  === BUTTON || !this.rc.bridge.isRunningInBrowser()) return

    if (!this.originialColor) {
      this.originialColor = window.getComputedStyle(this.element.nativeElement, null).getPropertyValue('background-color')
    }

    this.onHoverColor ? this.renderer.addClass(this.element.nativeElement,this.onHoverColor)
      : this.element.nativeElement.style.background = '#f2f5f7'
  }

  @HostListener ('click', ['$event']) onClick($event) {

    this.applyOriginalBg()

    if (!this.clickEnabled) return
    
    this.clickEnabled    = false
    this.allowClickDelay = this.allowClickDelay || ALLOW_CLICK_DELAY

    setTimeout(this.allowClick.bind(this), this.allowClickDelay)

    this.ncClick.emit($event)
  }

  ngAfterViewInit() {
    this.element.nativeElement.style.cursor = 'pointer'
    this.renderer.listen(this.element.nativeElement, 'mouseover', this.onMouseOver.bind(this))
    this.renderer.listen(this.element.nativeElement, 'mouseout',  this.applyOriginalBg.bind(this))
    this.renderer.listen(this.element.nativeElement, 'click',     this.applyOriginalBg.bind(this))
  }

  allowClick() {
    this.clickEnabled = true
  }

  /*=====================================================================
                              PRIVATE
  =====================================================================*/
  private applyOriginalBg() {

    if (this.onHoverColor){
      this.renderer.removeClass(this.element.nativeElement,this.onHoverColor) 
    } 

    if (this.element.nativeElement.tagName  === BUTTON || !this.rc.bridge.isRunningInBrowser()) return
    this.element.nativeElement.style.background = this.originialColor || 'initial'
  }
}
