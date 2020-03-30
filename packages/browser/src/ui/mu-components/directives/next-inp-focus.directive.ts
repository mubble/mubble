/*------------------------------------------------------------------------------
   About      : <Autofocuses the input element on page load every time>
   
   Created on : Thu Aug 10 2017
   Author     : Aditya Baddur
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/


import { Directive,
         Input, 
         Inject,
         HostListener,
         Output,
         EventEmitter
       }                      from '@angular/core'
import { RunContextBrowser }  from '@mubble/browser/rc-browser'

@Directive({
  selector: '[nextInpFocus]'
})

export class NextInpFocusDirective {

  @HostListener('keydown.enter', ['$event.target']) onHostSubmit(event : any ) {
    this.onEnter(event)
  }

  @Input('nextInpFocus') nextInpFocusElem : HTMLElement
  @Output() onSubmit : EventEmitter<any> = new EventEmitter<any>()

  constructor(@Inject('RunContext') protected rc  : RunContextBrowser) {
  }

  private onEnter(event : any) {
    if (this.nextInpFocusElem) {
      this.nextInpFocusElem.focus()
    } else {
      this.onSubmit.emit(event)
    }
  }
}