import {  Component, Input, HostBinding }     from '@angular/core'
import { animate, state, 
         style, transition, 
         trigger }                            from '@angular/core'

@Component({
  selector    : 'app-toast',
  templateUrl : './toast.component.html',
  styleUrls   : ['./toast.component.scss'],
  animations  : [
    trigger('visibilityChanged', [

      transition(':enter', [
        style({'opacity': 0}),
        animate('500ms', 
          style({'opacity': 1}))
      ]),

      transition(':leave', [
        style({'opacity': 1}),
        animate('500ms', 
          style({'opacity': 0}))
      ])
      
    ]),
  ]
})
export class ToastComponent {

  @Input() toastMessage : string

}