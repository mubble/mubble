/*------------------------------------------------------------------------------
   About      : <Autofocuses the input element on page load every time>
   
   Created on : Thu Aug 10 2017
   Author     : Aditya Baddur
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/


import { Directive, ElementRef, 
         AfterViewInit, ChangeDetectorRef } from '@angular/core';

@Directive({
  selector: '[ncAutoFocus]'
})

export class NcAutoFocusDirective implements AfterViewInit {

  constructor(private element   : ElementRef,
              private changeRef : ChangeDetectorRef) {
  }

  ngAfterViewInit() { 
    this.element.nativeElement.focus()
    this.changeRef.detectChanges()
  }
}