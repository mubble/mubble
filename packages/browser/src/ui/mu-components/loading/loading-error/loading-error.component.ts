/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Wed Aug 30 2017
   Author     : Sid
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { Component, OnInit, 
         Input, Output, 
         Inject, EventEmitter }             from '@angular/core'
import { RunContextBrowser }                from '../../../../rc-browser'

@Component({
  selector    : 'app-loading-error',
  templateUrl : './loading-error.component.html',
  styleUrls   : ['./loading-error.component.scss']
})
export class LoadingErrorComponent {

  @Input()  apiErrorText   : string
  @Input()  apiCanRetry    : string
  @Input()  apiRetryText   : string
  @Output() apiErrorAction : EventEmitter<any> = new EventEmitter<any>()
  
  constructor(@Inject('RunContext') private rc  : RunContextBrowser) { }

  onErrorAction() {
    this.apiErrorAction.emit()
  }
}
