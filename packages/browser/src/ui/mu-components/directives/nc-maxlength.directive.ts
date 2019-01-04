/*------------------------------------------------------------------------------
   About      : supports maxlength attribute for mobile devices
   
   Created on : Mon Mar 05 2018
   Author     : Aditya Baddur
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/


import { 
         Directive,
         ElementRef,  
         Input, 
         Renderer2,
         Output, 
         NgZone,
         EventEmitter 
       }                        from '@angular/core'


const KEY_UP  = 'keyup',
      PASTE   = 'paste',
      CUT     = 'cut',
      NUMERIC = 'numeric'

@Directive({
  selector: '[ncMaxLength]'
})

export class NcMaxLengthDirective {
  
  @Input('ncMaxLength') maxLength : number = 0
  @Output() updatedValue : EventEmitter<string> = new EventEmitter<string>()
   
  private eventHandlers : (()=>void)[] = []

  constructor(private element   : ElementRef,
              private renderer  : Renderer2,
              private ngZone    : NgZone) {
  }

  ngAfterViewInit() {
    this.maxLength  = Number(this.maxLength) 
    if (typeof this.maxLength !== 'number') return
    this.eventHandlers.push(this.renderer.listen(this.element.nativeElement, KEY_UP, this.keyUpHandler.bind(this)),
    this.renderer.listen(this.element.nativeElement, PASTE, this.clipBoardEventHandler.bind(this)),
    this.renderer.listen(this.element.nativeElement, CUT, this.clipBoardEventHandler.bind(this)))
    
  }

  private clipBoardEventHandler(event : any) {
    
    setTimeout(() => {
      this.ngZone.runOutsideAngular(() => {

        const element = event.srcElement

        if (element.value.length > this.maxLength) {
          element.value = element.value.substring(0, this.maxLength)
        } 

        const scrollHeight  = element.scrollHeight,
              clientHeight  = element.clientHeight
        if ( scrollHeight > clientHeight && element.scrollTop !== scrollHeight - clientHeight ) {
          element.scrollTop = scrollHeight - clientHeight
        }
        this.emitUpdatedValue(element.value)
      })
    }, 0)
  } 
 
  private keyUpHandler(event : any) { 
   
    this.ngZone.runOutsideAngular(() => {

      const element = event.srcElement

      if (element.inputMode) {
        const validInput =  element.inputMode === NUMERIC && element.value.trim().length 
                            && !isNaN(element.value)
                            
        if (!validInput) {
          // element.value = ''
          return
        }
      }

      if (element.value.length > this.maxLength) {
        element.value = element.value.substring(0, this.maxLength)
      } 

      const scrollHeight  = element.scrollHeight,
            clientHeight  = element.clientHeight
      if ( scrollHeight > clientHeight && element.scrollTop !== scrollHeight - clientHeight ) {
        element.scrollTop = scrollHeight - clientHeight
      }

      this.emitUpdatedValue(element.value)
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