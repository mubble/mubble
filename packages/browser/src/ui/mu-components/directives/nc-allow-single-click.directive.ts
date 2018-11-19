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
         HostBinding,
         HostListener,
         EventEmitter,
         Input, 
         Output }         from '@angular/core'

const ALLOW_CLICK_DELAY  = 1000

@Directive({
  selector: '[ncAllowSingleClick]'
})
export class NcAllowSingleClickDirective {
  
  @Input('ncPreventDoubleClick') allowClickDelay: number
  
  @Output() ncClick : EventEmitter<any> = new EventEmitter<any>()

  private clickEnabled: boolean = true

  constructor() {}

  @HostListener ('click', ['$event']) onClick($event) {

    if (!this.clickEnabled) return
    
    this.clickEnabled    = false
    this.allowClickDelay = this.allowClickDelay || ALLOW_CLICK_DELAY

    setTimeout(this.allowClick.bind(this), this.allowClickDelay)

    this.ncClick.emit($event)
  }

  allowClick() {
    this.clickEnabled = true
  }
}
