import { NgModule }                     from '@angular/core'
import { RouterModule,
         Routes
       }                                from '@angular/router'

import { BottomInComponent }            from './bottom-in/bottom-in.component'
import { ModalPopupComponent }          from './modal-popup/modal-popup.component'
import { ComponentRoutes }              from '../router/shared-router-constants'
import { LoadingOverlayComponent }      from './loading/loading-overlay/loading-overlay.component'
import { FilterComponent }              from './filter/filter.component'

const routes: Routes = [
  {
    path      : ComponentRoutes.LoadingOverlay,
    component : LoadingOverlayComponent
  },
  { 
    path      : ComponentRoutes.Modal,
    component : ModalPopupComponent,
    outlet    : 'modal'
  },
  {
    path      : ComponentRoutes.BottomIn,
    component : BottomInComponent,
    outlet    : 'modal'
  },
  {
    path      : ComponentRoutes.Filter,
    component : FilterComponent
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