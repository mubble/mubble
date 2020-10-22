import { Directive,
         Input,
         HostListener,
         ElementRef }       from '@angular/core'

export enum IMAGE_TYPE {
  WALLET  = 'WALLET',
  APP     = 'APP',
  BANK    = 'BANK',
  PROFILE = 'PROFILE'
}

const APP_ICON     = 'images/app-logo-hoz.jpg',
      WALLET_ICON  = 'svg-icons/ic-primary-wallet.svg',
      BANK_ICON    = 'svg-icons/ic-bank-activity-fill.svg',
      PROFILE_ICON = 'svg-icons/ic-user-gray.svg'

@Directive({
  selector: '[ncImgFallback]'
})

export class NcImgFallbackDirective {

  @Input() data: [IMAGE_TYPE, any] | IMAGE_TYPE

  constructor(private element: ElementRef) { }

  @HostListener ('error') onError() {

    if (!Array.isArray(this.data)) {
      this.setFallbackImage(this.data)
      return
    }
    
    if (this.data[1] && this.data[1].r && this.data[1].g && this.data[1].b) {
      this.element.nativeElement.style.background = this.getColor(this.data[1])
      return
    }

    this.setFallbackImage(this.data[0])
  }

  private setFallbackImage(type: IMAGE_TYPE) {

    switch(type) {
      
      case IMAGE_TYPE.WALLET:
        this.element.nativeElement.src  = WALLET_ICON
        break

      case IMAGE_TYPE.APP:
        this.element.nativeElement.src  = APP_ICON
        break

      case IMAGE_TYPE.BANK  :
        this.element.nativeElement.src  = BANK_ICON
        break

      case IMAGE_TYPE.PROFILE:
        this.element.nativeElement.src  = PROFILE_ICON
        break
        
      default:
        this.element.nativeElement.src = APP_ICON
    }
  }

  private getColor(color: any): string {
    return `rgb(${color.r}, ${color.g}, ${color.b})`
  }
}


