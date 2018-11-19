import { NgModule, ModuleWithProviders }    from '@angular/core'

import { CommonModule }                     from '@angular/common'

import { FormsModule }                      from '@angular/forms'

import { BottomInComponent }                from './bottom-in/bottom-in.component'
import { ModalPopupComponent }              from './modal-popup/modal-popup.component'
import { MuComponentsRoutingModule }        from './mu-components-routing.module'

import { LoadingComponent }                 from './loading/loading.component'
import { LoadingErrorComponent }            from './loading/loading-error/loading-error.component'
import { LoadingOverlayComponent }          from './loading/loading-overlay/loading-overlay.component'
import { ToastComponent }                   from './toast/toast.component'
import { AlertDialogComponent }             from './alert-dialog/alert-dialog.component'
import { NcAllowSingleClickDirective,
         NcMaxLengthDirective,
         NcAutoFocusDirective }             from './directives'

import { TRANSLATION_PROVIDERS,
         TranslateService,
         TranslatePipe }                    from './translate'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    MuComponentsRoutingModule
  ],

  declarations: [
    BottomInComponent,
    ModalPopupComponent,
    LoadingComponent,
    LoadingErrorComponent,
    LoadingOverlayComponent,
    ToastComponent,
    AlertDialogComponent,


    NcAllowSingleClickDirective,
    NcAutoFocusDirective,
    NcMaxLengthDirective,

    TranslatePipe
  ],

  entryComponents : [
    AlertDialogComponent
  ],
  
  exports: [
    BottomInComponent,
    ModalPopupComponent,
    LoadingComponent,
    LoadingErrorComponent,
    LoadingOverlayComponent,
    ToastComponent,

    NcAllowSingleClickDirective,
    NcAutoFocusDirective,
    NcMaxLengthDirective,


    TranslatePipe
  ]
})

export class MuComponentsModule {
  static forRoot(): ModuleWithProviders {
    return {
      ngModule: MuComponentsModule,
      providers: [
        TRANSLATION_PROVIDERS,
        TranslateService
      ]
    }
  }
}