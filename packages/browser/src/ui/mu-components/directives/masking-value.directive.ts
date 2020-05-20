/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Wed May 20 2020
   Author     : Aditya Baddur
   
   Copyright (c) 2020 Obopay. All rights reserved.

   Fails under following condition : 
   1. Quick inputs.
   2. If user holds on to the key.
------------------------------------------------------------------------------*/

import { Directive,
         Output,
         EventEmitter,
         ElementRef,
         Renderer2,
         Input,
         NgZone
       }                            from '@angular/core'
import { NcMaxLengthDirective }     from './nc-maxlength.directive'

const KEY_UP    = 'keyup',
      BACKSPACE = 'Backspace'


export interface MaskingParams {
  maxLength        : number
  maskedLength     : number
  maskWith        ?: string
  startSkipCount  ?: number
  endSkipCount    ?: number
}

@Directive({
  selector: '[maskingValue]'
})

export class MaskingValueDirective extends NcMaxLengthDirective {

  @Input('maskingValue') maskingParams : MaskingParams

  @Output() maskedValue : EventEmitter<string> = new EventEmitter<string>()

  private updatedString : string = ''

  constructor(protected element   : ElementRef,
              protected renderer  : Renderer2,
              protected ngZone    : NgZone) {

    super(element, renderer, ngZone)
  }

  ngOnInit() {
    this.maxLength = this.maskingParams.maxLength

  }
  
  ngAfterViewInit() {

    super.ngAfterViewInit()

    if (this.element.nativeElement.value) {
      const value         = this.element.nativeElement.value,
            maskingParams = this.maskingParams,
            startSkipCount  = maskingParams.startSkipCount || 0,
            totalSkipCount  = startSkipCount + (maskingParams.endSkipCount   || 0)

      this.value(value, startSkipCount, totalSkipCount)
      this.updatedString  = value
    }


    this.renderer.listen(this.element.nativeElement, KEY_UP, this.handelEvent.bind(this))
  }

  /*=====================================================================
                              PRIVATE
  =====================================================================*/
  private value(value : string, startSkipCount : number, totalSkipCount : number) {

    value = value.substring(0, startSkipCount) 
            + value.substring(startSkipCount, totalSkipCount+ 1).replace(/\w+/g, this.maskingParams.maskWith || '*') 
            + value.substring(totalSkipCount + 1)
  
    return value

  }

  private handelEvent(event : any) {

    super.handleEvent(event)
    
    let startSkipCount  = this.maskingParams.startSkipCount || 0,
        endSkipCount    = this.maskingParams.endSkipCount   || 0,
        value           = event.srcElement.value,
        totalSkipCount  = startSkipCount  + endSkipCount
        length          = value.length

    const isBackPressed = event.key === BACKSPACE

    if (!isBackPressed && this.updatedString.length === this.maskingParams.maxLength) {
      return
    }


    if (isBackPressed) {
      this.updatedString  = this.updatedString.substr(0, length)
      return
    }

    if (length <= startSkipCount) {
      this.updatedString  = value.substr(0, startSkipCount)
    }

    if (length > startSkipCount && length <= totalSkipCount) {
      this.updatedString  = this.updatedString.substr(0) + 
                            value.substr(this.updatedString.length, length)
    }

    if (length > totalSkipCount && length <= this.maskingParams.maxLength) {
      this.updatedString  = this.updatedString.substr(0) + value.substr(length - 1)
    }

    
    event.srcElement.value  = this.value(value, startSkipCount, totalSkipCount)
    
    this.maskedValue.emit(this.updatedString)

  }

}
