import { NgModule,
         ModuleWithProviders
       }                                    from '@angular/core'

import { CommonModule }                     from '@angular/common'

import { FormsModule,
         ReactiveFormsModule 
       }                                    from '@angular/forms'
import { FlexLayoutModule }                 from '@angular/flex-layout'
import { MatFormFieldModule,
         MatDatepickerModule,
         MatInputModule,
         MatSelectModule
       }                                    from '@angular/material'

import { BottomInComponent }                from './bottom-in/bottom-in.component'
import { ModalPopupComponent }              from './modal-popup/modal-popup.component'
import { MuComponentsRoutingModule }        from './mu-components-routing.module'

import { LoadingComponent }                 from './loading/loading.component'
import { LoadingErrorComponent }            from './loading/loading-error/loading-error.component'
import { LoadingOverlayComponent }          from './loading/loading-overlay/loading-overlay.component'
import { ToastComponent }                   from './toast/toast.component'
import { InfiniteScrollComponent }          from './infinite-scroll/infinite-scroll.component'
import { FilterTransComponent }             from './filter-trans/filter-trans.component'

import { AlertDialogComponent }             from './alert-dialog/alert-dialog.component'
import { NcMaxLengthDirective,
         NcAutoFocusDirective, 
         LongPressDirective, 
         NcStyleClassDirective,
         NextInpFocusDirective
       }                                    from './directives'
import { TRANSLATION_PROVIDERS,
         TranslateService,
         TranslatePipe }                    from './translate'
import { CustomBreakPointsProvider }        from './custom-breakpoints'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    FlexLayoutModule,    
    MuComponentsRoutingModule,
    MatFormFieldModule,
    MatDatepickerModule,
    MatInputModule,
    MatSelectModule
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
    FilterTransComponent,


    NcAutoFocusDirective,
    NcMaxLengthDirective,
    LongPressDirective, 
    NcStyleClassDirective,
    NextInpFocusDirective,
  
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
    FilterTransComponent,

    NcAutoFocusDirective,
    NcMaxLengthDirective,
    LongPressDirective, 
    NcStyleClassDirective,
    NextInpFocusDirective,

    TranslatePipe,
    
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    FlexLayoutModule
    
  ],
  providers: [
    CustomBreakPointsProvider
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