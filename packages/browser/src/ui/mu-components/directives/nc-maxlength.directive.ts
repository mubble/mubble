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
        if (event.srcElement.value.length > this.maxLength) {
          event.srcElement.value = event.srcElement.value.substring(0, this.maxLength)
        } 

        const scrollHeight  = event.srcElement.scrollHeight,
              clientHeight  = event.srcElement.clientHeight
        if ( scrollHeight > clientHeight && event.srcElement.scrollTop !== scrollHeight - clientHeight ) {
          event.srcElement.scrollTop = scrollHeight - clientHeight
        }
        this.emitUpdatedValue(event)
      })
    }, 0)
  } 
 
  private keyUpHandler(event : any) { 
   
    this.ngZone.runOutsideAngular(() => {

      if (event.srcElement.inputMode) {
        const validInput =  event.srcElement.value.trim().length && event.srcElement.inputMode === NUMERIC 
                            && !isNaN(event.srcElement.value)
                            
        if (!validInput) {
          event.srcElement.value = ''
          return
        }
      }

      if (event.srcElement.value.length > this.maxLength) {
        event.srcElement.value = event.srcElement.value.substring(0, this.maxLength)
      } 

      const scrollHeight  = event.srcElement.scrollHeight,
            clientHeight  = event.srcElement.clientHeight
      if ( scrollHeight > clientHeight && event.srcElement.scrollTop !== scrollHeight - clientHeight ) {
        event.srcElement.scrollTop = scrollHeight - clientHeight
      }

      this.emitUpdatedValue(event)
    })
  }

  private emitUpdatedValue(event : any) {
    this.ngZone.run(() => {
      this.updatedValue.emit(event.srcElement.value)
    })
    
  }

  ngOnDestroy() {
    for (const eventHandler of this.eventHandlers) {
      eventHandler()
    }
    this.eventHandlers = []
  }

}