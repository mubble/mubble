import {
         Directive,
         Output,
         HostListener,
         ElementRef,
         EventEmitter,
         Input,
         Renderer2
       }                          from '@angular/core'
import { Mubble }                 from '@mubble/core'

@Directive({
  selector: '[validateImg]'
})

export class ValidateImgDirective {

  @Input() public payload   : Mubble.uObject<string> // { base64: string, ...args }
  @Output() public imgLoaded : EventEmitter<Mubble.uObject<string>> = new EventEmitter<Mubble.uObject<string>>()
  @Output() public imgError  : EventEmitter<Mubble.uObject<string>> = new EventEmitter<Mubble.uObject<string>>()

  constructor(private element   : ElementRef,
              private renderer  : Renderer2) {}

  ngAfterViewInit() {

    this.renderer.addClass(this.element.nativeElement, 'img-validator')
    this.element.nativeElement.src = this.payload.base64
  }

  @HostListener('error') onError() {
    this.imgError.emit(this.payload)
  }

  @HostListener('load') onLoad() {
    this.imgLoaded.emit(this.payload)
  }

}
