import { NgModule }                     from '@angular/core'
import { RouterModule, Routes }         from '@angular/router'

import { BottomInComponent }            from './bottom-in/bottom-in.component'
import { ModalPopupComponent }          from './modal-popup/modal-popup.component'
import { ComponentRoutes }              from '../router/shared-router-constants'
import { LoadingOverlayComponent }      from './loading/loading-overlay/loading-overlay.component'

const routes: Routes = [
  {
    path: ComponentRoutes.LoadingOverlay,
    component: LoadingOverlayComponent
  },
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