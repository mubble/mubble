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


const KEY_DOWN  = 'keydown',
      PASTE     = 'paste',
      CUT       = 'cut',
      NUMERIC   = 'numeric',
      BACKSPACE = 'Backspace'

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
    this.eventHandlers.push(this.renderer.listen(this.element.nativeElement, KEY_DOWN, this.eventHandler.bind(this)),
    this.renderer.listen(this.element.nativeElement, PASTE, this.clipBoardEventHandler.bind(this)),
    this.renderer.listen(this.element.nativeElement, CUT, this.clipBoardEventHandler.bind(this)))
    
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

      const element = event.srcElement

      if (element.inputMode) {

        const validInput : boolean =  element.inputMode === NUMERIC && element.value.trim().length 
                                      && !isNaN(element.value)

        if (validInput === false) {
          const currentValue  = element.value as string,
                invalidIndex  = currentValue.indexOf(event.key)

          element.value = (element.value as string).substring(0, invalidIndex)
          return
        }
      }

      if (event.key === BACKSPACE) {
        this.emitUpdatedValue(element.value)
        return
      }

      if (element.value.length > this.maxLength-1) {
        event.preventDefault()
        event.stopPropagation()
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