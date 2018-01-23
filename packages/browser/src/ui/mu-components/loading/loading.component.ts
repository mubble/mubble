/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Wed Aug 30 2017
   Author     : Sid
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { Component, OnInit, Input, Inject } from '@angular/core'
import { RunContextBrowser }                from '../../../rc-browser'

@Component({
  selector    : 'loading',
  templateUrl : './loading.component.html',
  styleUrls   : ['./loading.component.scss']
})
export class LoadingComponent implements OnInit {

  @Input() apiLoadingText       : string
  @Input() apiLoadingBottomIn   : boolean
  
  constructor(@Inject('RunContext') private rc  : RunContextBrowser) { }

  ngOnInit() {
    if (this.apiLoadingBottomIn === undefined) this.apiLoadingBottomIn = false
  }
}
