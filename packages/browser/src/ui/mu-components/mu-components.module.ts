import { NgModule, ModuleWithProviders }    from '@angular/core'

import { CommonModule }                     from '@angular/common'

import { FormsModule,
         ReactiveFormsModule 
       }                                    from '@angular/forms'
import { FlexLayoutModule }                 from '@angular/flex-layout'

import { BottomInComponent }                from './bottom-in/bottom-in.component'
import { ModalPopupComponent }              from './modal-popup/modal-popup.component'
import { MuComponentsRoutingModule }        from './mu-components-routing.module'

import { LoadingComponent }                 from './loading/loading.component'
import { LoadingErrorComponent }            from './loading/loading-error/loading-error.component'
import { LoadingOverlayComponent }          from './loading/loading-overlay/loading-overlay.component'
import { ToastComponent }                   from './toast/toast.component'
import { InfiniteScrollComponent }          from './infinite-scroll/infinite-scroll.component'

import { AlertDialogComponent }             from './alert-dialog/alert-dialog.component'
import { NcAllowSingleClickDirective,
         NcMaxLengthDirective,
         NcAutoFocusDirective, 
         LongPressDirective, 
         NcStyleClassDirective
}                                           from './directives'

import { TRANSLATION_PROVIDERS,
         TranslateService,
         TranslatePipe }                    from './translate'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    FlexLayoutModule,
    
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
    InfiniteScrollComponent,


    NcAllowSingleClickDirective,
    NcAutoFocusDirective,
    NcMaxLengthDirective,
    LongPressDirective, 
    NcStyleClassDirective,
  
    TranslatePipe
  ],

  entryComponents : [
    AlertDialogComponent
  ],
  
  exports: [

    CommonModule,
    FormsModule,
    ReactiveFormsModule,

    BottomInComponent,
    ModalPopupComponent,
    LoadingComponent,
    LoadingErrorComponent,
    LoadingOverlayComponent,
    ToastComponent,
    InfiniteScrollComponent,

    NcAllowSingleClickDirective,
    NcAutoFocusDirective,
    NcMaxLengthDirective,
    LongPressDirective, 
    NcStyleClassDirective,

    TranslatePipe,
    
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    FlexLayoutModule
    
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