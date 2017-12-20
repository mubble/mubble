import { NgModule }                     from '@angular/core'
import { RouterModule, Routes }         from '@angular/router'

import { BottomInComponent }            from './bottom-in/bottom-in.component'
import { ModalPopupComponent }          from './modal-popup/modal-popup.component'
import { ComponentRoutes }              from '../router/shared-router-constants'

const routes: Routes = [
  { 
    path: ComponentRoutes.Modal,
    component: ModalPopupComponent,
    outlet: 'modal'
  },
  {
    path: ComponentRoutes.BottomIn,
    component: BottomInComponent,
    outlet: 'modal'
  }
]

@NgModule({
  imports: [
    RouterModule.forChild(routes)
  ],
  exports: [
    RouterModule
  ]
})
export class MuComponentsRoutingModule {}