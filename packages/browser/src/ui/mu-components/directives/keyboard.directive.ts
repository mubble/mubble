/*------------------------------------------------------------------------------
   About      : <Autofocuses the input element on page load every time>
   
   Created on : Thu Aug 10 2017
   Author     : Aditya Baddur
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/


import { Directive, 
         ElementRef,
         Input, 
         Inject,
         Renderer2
       }                      from '@angular/core'
import debounce               from 'lodash/debounce'

@Directive({
  selector: '[keyboard]'
})

export class KeyboardDirective {

  @Input('keyboard') parentDiv  : HTMLElement

  private originalParentHeight  : number
  private originalBodyHeight    : number
  
  constructor(@Inject('RunContext') protected rc  : any,
              private element                     : ElementRef,
              private renderer                    : Renderer2) {
  }

  ngAfterViewInit() {
    this.originalParentHeight = this.parentDiv.getBoundingClientRect().height
    this.renderer.addClass(this.element.nativeElement, 'mui-event-adjust-pan-screen')
    this.renderer.listen(this.element.nativeElement, 'mui-event-adjust-pan-screen', this.onCustomEvent.bind(this))
    this.renderer.listen(this.element.nativeElement, 'focus', this.onCustomEvent.bind(this))
    this.renderer.listen(this.element.nativeElement, 'blur', this.onBlur.bind(this))

    if (this.rc.bridge.isRunningInMWeb()) {
      this.handleKeyBoardEvents()
      window.addEventListener('resize', debounce(this.handleKeyBoardEvents.bind(this), 300))
    }
  }

  private handleKeyBoardEvents() {

    const bodyHeight  = document.body.getBoundingClientRect().height

    if (!this.originalBodyHeight) this.originalBodyHeight = bodyHeight

    const keyboardHeight          = this.originalBodyHeight - bodyHeight
    this.rc.bridge.currKeyboardHt = - keyboardHeight

    this.onCustomEvent()

  }

  private onBlur() {

    if (this.rc.bridge.isRunningInBrowser() && !this.rc.bridge.isRunningInMWeb()) return

    this.parentDiv.style.height = this.originalParentHeight + 'px'

    if (this.rc.bridge.isRunningInMWeb()) {
      window.scrollTo(0,0)
    }
  }

  private onCustomEvent() {

    if (this.rc.bridge.isRunningInBrowser() && !this.rc.bridge.isRunningInMWeb()) return

    const keyboardHeight  = this.rc.bridge.currKeyboardHt,
          parentDiv       = this.parentDiv,
          parentDivRect   = parentDiv.getBoundingClientRect()
     
    if (document.activeElement !== this.element.nativeElement) return

    if (keyboardHeight < 0) {
      parentDiv.style.height = (parentDivRect.height + keyboardHeight) + 'px'

      const scrollOptions = {
        behaviour : 'smooth',
        block     : 'center',
        inline    : 'start'
      }

      this.element.nativeElement.scrollIntoView(scrollOptions)

      if (this.rc.bridge.isRunningInMWeb()) {
        window.scrollTo(0,0)
      }
  
    } else {
      this.onBlur()
    }
  }

  ngOnDestroy() {
    this.renderer.removeClass(this.element.nativeElement, 'mui-event-adjust-pan-screen')
  }
}