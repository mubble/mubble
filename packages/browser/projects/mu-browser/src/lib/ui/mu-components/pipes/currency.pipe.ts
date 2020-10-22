import { Pipe, 
         PipeTransform,
         Inject 
       }                      from '@angular/core'
import { RunContextBrowser }  from '../../../rc-browser'

const INR       = 'INR',
      CURRENCY  = 'currency' 

@Pipe({
  name: 'inrcurrency'
})

export class CurrencyPipe implements PipeTransform {

  constructor (@Inject('RunContext') private rc : RunContextBrowser) { }

  transform(value: number, decimalReq : boolean = true) : string {

    if (value === undefined) return

    const options = {
      currency              : INR,
      style                 : CURRENCY,
      maximumFractionDigits : 2
    } as Intl.NumberFormatOptions

    const formattedNumber = value.toLocaleString('en-IN', options)

    return decimalReq ? formattedNumber : formattedNumber.split('.')[0]
  }

}
