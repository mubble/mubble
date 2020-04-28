import { Directive,
         Output,
         EventEmitter,
         ElementRef,
         Renderer2,
         Input
       }                            from '@angular/core'

const KEY_UP  = 'keyup'

@Directive({
  selector: '[maskingValue]'
})

export class MaskingValueDirective {

  updatedString : string = ''

  @Input('maskedLength') maskedLength : number
  @Input('maxStringLength') maxLength : number
  @Output() value : EventEmitter<string> = new EventEmitter<string>()

  constructor(private element : ElementRef,
              private renderer: Renderer2) {

  }

  ngAfterViewInit() {
    this.renderer.listen(this.element.nativeElement, KEY_UP, this.eventHandler.bind(this))
  }

  private eventHandler(event : any) {
    if (event.srcElement.value.length > this.updatedString.length) {
      this.updatedString  += JSON.parse(JSON.stringify(event.srcElement.value.substr(event.srcElement.value.length - 1)))
    } else {
      if (event.srcElement.value.length) {
        this.updatedString  = this.updatedString.substr(0, event.srcElement.value.length)
      } else {
        this.updatedString  = ''
      }
    }

    if (this.maxLength === this.updatedString.length) {
      this.value.emit(this.updatedString)
    }

    if (!this.maskedLength) return
      
    if (event.srcElement.value.length <= this.maskedLength) {
      event.srcElement.value = event.srcElement.value.replace(/\w/g, 'X')
    }

  }

}
