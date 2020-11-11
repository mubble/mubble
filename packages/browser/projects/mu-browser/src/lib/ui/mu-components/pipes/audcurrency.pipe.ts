import { Pipe, 
         PipeTransform,
         Inject 
       }                      from '@angular/core'
import { RunContextBrowser }  from '../../../rc-browser'

const AUD       = 'AUD',
      CURRENCY  = 'currency' 

@Pipe({
  name: 'audcurrency'
})

export class AUDCurrencyPipe implements PipeTransform {

  constructor (@Inject('RunContext') private rc : RunContextBrowser) { }

  transform(value: number, decimalReq : boolean = true) : string {

    if (value === undefined) return

    const options = {
      currency              : AUD,
      style                 : CURRENCY,
      maximumFractionDigits : 2
    } as Intl.NumberFormatOptions

    const formattedNumber = value.toLocaleString('en-AU', options)

    return decimalReq ? formattedNumber : formattedNumber.split('.')[0]
  }

}
