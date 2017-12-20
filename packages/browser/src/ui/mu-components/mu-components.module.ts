import { NgModule, ModuleWithProviders }    from '@angular/core'

import { CommonModule }                     from '@angular/common'

import { BottomInComponent }                from './bottom-in/bottom-in.component'
import { ModalPopupComponent }              from './modal-popup/modal-popup.component'
import { MuComponentsRoutingModule }        from './mu-components-routing.module'

@NgModule({
  imports: [
    CommonModule,
    MuComponentsRoutingModule
  ],

  declarations: [
    BottomInComponent,
    ModalPopupComponent
  ],
  
  exports: [
    BottomInComponent,
    ModalPopupComponent
  ]
})
export class MuComponentsModule {}