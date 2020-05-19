import { Directive,
         Output,
         EventEmitter,
         ElementRef,
         Renderer2,
         Input
       }                            from '@angular/core'

const KEY_UP  = 'keyup'

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

export class MaskingValueDirective {

  @Input('maskingValue') maskingParams : MaskingParams

  @Output() maskedValue : EventEmitter<string> = new EventEmitter<string>()

  masked : any
  updatedString : string = ''

  constructor(private element : ElementRef,
              private renderer: Renderer2) {

  }

  ngOnInit() {
    this.masked = this.renderer.createElement('input')
    this.renderer.appendChild(this.element.nativeElement.parentElement, this.masked)   
    this.masked.className = this.element.nativeElement.className
    this.element.nativeElement.hidden = true
    this.masked.value = this.element.nativeElement.value
  }
  
  ngAfterViewInit() {
    this.renderer.listen(this.masked, KEY_UP, this.eventHandler.bind(this))
  }

  private eventHandler(event : any) {

    let startSkipCount = this.maskingParams.startSkipCount || 0,
        endSkipCount   = this.maskingParams.endSkipCount   || 0        

    if (event.srcElement.value.length > this.updatedString.length) {
      this.updatedString  += JSON.parse(JSON.stringify(event.srcElement.value.substr(event.srcElement.value.length - 1)))
    } else {
      if (event.srcElement.value.length) {
        this.updatedString  = this.updatedString.substr(0, event.srcElement.value.length)
      } else {
        this.updatedString  = ''
      }
    }

    if (this.maskingParams.maxLength === this.updatedString.length) {
      this.element.nativeElement.value = this.updatedString
      this.maskedValue.emit(this.updatedString)
    }

    if (!this.maskingParams.maskedLength) return
       
    const length = event.srcElement.value.length
    if (length >= startSkipCount && length <= this.maskingParams.maxLength - endSkipCount) {
      event.srcElement.value = event.srcElement.value.substr(0, length - 1) + this.maskingParams.maskWith   
    }


    // Previous code when startSkipCount and endSkipCount was not included in the params
    // if (event.srcElement.value.length <= this.maskingParams.maskedLength) {
    //  event.srcElement.value = event.srcElement.value.replace(/\w/g, 'X')      
    // }
  }

}
