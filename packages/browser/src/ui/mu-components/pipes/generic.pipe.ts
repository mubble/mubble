import { Pipe, 
         PipeTransform,
         Inject, 
         Injector
       }                      from '@angular/core'
import { RunContextBrowser }  from '@mubble/browser/rc-browser'


@Pipe({ name: 'genericPipe' })

export class GenericPipe implements PipeTransform {

  constructor (@Inject('RunContext') private rc : RunContextBrowser,
               private injector                 : Injector) { 

  }

  transform(value : any, pipeName : string, pipeParams : any[]) {
    
    if (!pipeName) return value

    const pipe = this.injector.get<PipeTransform>(<any>pipeName) 

    if (pipe.transform && typeof  pipe.transform === 'function') {

      if (pipeParams) return pipe.transform(value, ...pipeParams)

      return pipe.transform(value)
    }
    return value  
  }


}
