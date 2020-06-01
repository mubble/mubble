/*------------------------------------------------------------------------------
   About      : supports maxlength attribute for mobile devices
   
   Created on : Mon Mar 05 2018
   Author     : Aditya Baddur
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/


import { Directive,
         ElementRef,  
         Input, 
         Renderer2,
         Output, 
         NgZone,
         EventEmitter
       }                        from '@angular/core'


const KEY_UP    = 'keyup',
      PASTE     = 'paste',
      CUT       = 'cut',
      NUMERIC   = 'numeric',
      BACKSPACE = 'Backspace'

const pattern = /[\/\- ]/

@Directive({
  selector: '[ncMaxLength]'
})

export class NcMaxLengthDirective {
  
  @Input('ncMaxLength') protected maxLength : number = 0
  @Input('format') format : string

  @Output() updatedValue : EventEmitter<string> = new EventEmitter<string>()
   
  private eventHandlers : (()=>void)[] = []

  constructor(protected element   : ElementRef,
              protected renderer  : Renderer2,
              protected ngZone    : NgZone) {
  }

  ngAfterViewInit() {
    this.maxLength  = Number(this.maxLength) 
    if (typeof this.maxLength !== 'number') return
    this.eventHandlers.push(this.renderer.listen(this.element.nativeElement, KEY_UP, this.eventHandler.bind(this)),
    this.renderer.listen(this.element.nativeElement, PASTE, this.clipBoardEventHandler.bind(this)),
    this.renderer.listen(this.element.nativeElement, CUT, this.clipBoardEventHandler.bind(this)))
    
  }

  protected handleEvent(event : any) {
    this.eventHandler(event)
  }

  private clipBoardEventHandler(event : any) {
    
    setTimeout(() => {
      this.ngZone.runOutsideAngular(() => {
        this.eventHandler(event)
      })
    }, 0)
  } 
 
  private eventHandler(event : any) { 
   
    this.ngZone.runOutsideAngular(() => {

      const element   = event.srcElement

      if (element.inputMode) {

        const validInput : boolean =  element.inputMode === NUMERIC && element.value.trim().length 
                                      && !isNaN(element.value)

        if (validInput === false) {
          const currentValue  = element.value as string,
                invalidIndex  = currentValue.indexOf(event.key)

          element.value = (element.value as string).substring(0, invalidIndex)
          event.srcElement.value  = element.value
          return
        }
      }

      
      if (event.key === BACKSPACE) {
        this.emitUpdatedValue(element.value)
        return
      }

      if (element.value.length > this.maxLength) { 
        event.preventDefault()
        element.value = element.value.substring(0, this.maxLength)
      } 

      if (this.format) {

        const formatStr = this.format
        let val = element.value

        for (let i = 0 ; i < element.value.length; i++) {
      
            if (pattern.test(formatStr[i + 1]) && val[i + 1] !== formatStr[i + 1]) {
              val = val.substr(0,i + 1) + formatStr[i + 1] + val.substr(i + 1)
            }    
        }
        element.value = val
      }

      const scrollHeight  = element.scrollHeight,
            clientHeight  = element.clientHeight
      if ( scrollHeight > clientHeight && element.scrollTop !== scrollHeight - clientHeight ) {
        element.scrollTop = scrollHeight - clientHeight
      }

      this.emitUpdatedValue(element.value)
      event.srcElement.value  = element.value
      return
    })
  }

  private emitUpdatedValue(value: string) {
    this.ngZone.run(() => {
      this.updatedValue.emit(value)
    })
    
  }

  ngOnDestroy() {
    for (const eventHandler of this.eventHandlers) {
      eventHandler()
    }
    this.eventHandlers = []
  }

}