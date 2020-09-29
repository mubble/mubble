/*------------------------------------------------------------------------------
   About      : Directive to provide colorful box with name initial inside of it
   
   Created on : Tue Dec 03 2019
   Author     : Pulkit Chaturvedi
   
   Copyright (c) 2019 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { Directive,
         Input,
         ElementRef 
       }                        from '@angular/core'
       
@Directive({
  selector: '[ncFallbackChar]'
})

export class NcFallbackCharDirective {

  private dynamicColorObj : any = {} 
  private initialChar     : string

  @Input('ncFallbackChar') data     :  string
  @Input('needOneChar') needOneChar : boolean 

  constructor(private element : ElementRef) { 

  }

  ngAfterViewInit() {
    this.createDynamicColor()
    this.initialChar = this.getFirstCharacter(this.data)
    this.setColor(this.initialChar)
  }

  createDynamicColor() {
    const l = '60%'
  
    let cac = 64,
        spH = 0,
        spL = 0

    for(let i=1; i<=26; i++) {
      const h = spH + 10
      spH += 10

      for(let j=0; j<=26; j++) {
        const s = j ? spL + 3 : 60
        spL += 3
        const col = `hsl(${h}, ${s}%, ${l})`
        if(j) {
          this.dynamicColorObj[`${String.fromCharCode(cac + i)}${String.fromCharCode(cac + j)}`] = col
        } else {
          this.dynamicColorObj[String.fromCharCode(cac + i)] = col
        }
        
      }

      spL = 0
    }
  }

  getFirstCharacter(str : string) : string {
    const strArr : string[] = str.split(' ')

    const regExp = new RegExp('[a-zA-Z][a-zA-Z ]*')

    const charStr = strArr.filter((str) => {
      return regExp.test(str)
    })

    let initials : string

    if (this.needOneChar) {
      return initials = charStr[0].charAt(0).toUpperCase()
    }
    
    if (charStr.length > 1) {
      initials = (charStr[0].charAt(0) + strArr[1].charAt(0)).toUpperCase()
    } else {
      initials = charStr[0].charAt(0).toUpperCase()
    }

    return initials
  }

  setColor(key : string) {
    this.dynamicColorObj[key] as string
    this.element.nativeElement.innerHTML        = this.initialChar
    this.element.nativeElement.style.background = this.dynamicColorObj[key] as string
  }
}
