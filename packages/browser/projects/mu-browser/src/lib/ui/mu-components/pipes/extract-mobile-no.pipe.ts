import { Pipe, 
         PipeTransform,
         Inject 
       }                             from '@angular/core'
import { RunContextBrowser }        from '../../../rc-browser'


@Pipe({
  name: 'extractMobileNo'
})

export class ExtractMobileNoPipe implements PipeTransform {

  constructor (@Inject('RunContext') private rc : RunContextBrowser) {

  }

  transform(value: string) : string {
    return this.rc.utils.get10digitMobNumber(value);
  }

}
