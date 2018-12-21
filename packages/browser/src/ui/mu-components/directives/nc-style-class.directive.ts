/*------------------------------------------------------------------------------
   About      : dynamically adds class to the element
   
   Created on : Mon Jul 30 2018
   Author     : Aditya Baddur
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { 
         Directive,
         ElementRef,  
         Input, 
         Renderer2, 
       }                        from '@angular/core'

@Directive({
  selector: '[ncStyleClass]'
})

export class NcStyleClassDirective {

  @Input('ncStyleClass') ncStyleClass : string 

  constructor(private element   : ElementRef,
              private renderer  : Renderer2) {
  }

  ngAfterViewInit() {
    this.renderer.addClass(this.element.nativeElement, this.ncStyleClass)
  }

}