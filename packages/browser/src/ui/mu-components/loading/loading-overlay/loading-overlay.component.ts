/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Wed Aug 30 2017
   Author     : Sid
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { Component, OnInit, 
         OnDestroy, Input, 
         AfterViewInit, Inject }            from '@angular/core'

@Component({
  selector    : 'loading-overlay',
  templateUrl : './loading-overlay.component.html',
  styleUrls : ['./loading-overlay.component.scss']
})
export class LoadingOverlayComponent {
  
  @Input() loadingText  : string

  constructor() {
  }
}