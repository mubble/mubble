import { NgModule,
         ModuleWithProviders
       }                                    from '@angular/core'
import { FormsModule,
         ReactiveFormsModule 
       }                                    from '@angular/forms'
import { CommonModule }                     from '@angular/common'
import { FlexLayoutModule }                 from '@angular/flex-layout'
import { MatCheckboxModule,
         MatDatepickerModule,
         MatFormFieldModule,
         MatInputModule,
         MatSelectModule,
         MatAutocompleteModule,
         MatRadioModule,
         MatProgressBarModule
       }                                    from '@angular/material'

import { MuComponentsRoutingModule }        from './mu-components-routing.module'

import { TRANSLATION_PROVIDERS,
         TranslateService,
         TranslatePipe }                    from './translate'
         
import { CustomBreakPointsProvider }        from './custom-breakpoints'

import { TableModule }                      from 'primeng/table'

import { BottomInComponent }                from './bottom-in/bottom-in.component'
import { ModalPopupComponent }              from './modal-popup/modal-popup.component'
import { LoadingComponent }                 from './loading/loading.component'
import { LoadingErrorComponent }            from './loading/loading-error/loading-error.component'
import { LoadingOverlayComponent }          from './loading/loading-overlay/loading-overlay.component'
import { ToastComponent }                   from './toast/toast.component'
import { InfiniteScrollComponent }          from './infinite-scroll/infinite-scroll.component'
import { FilterComponent }                  from './filter/filter.component'
import { InputContainerComponent}           from './input-container/input-container.component'
import { AlertDialogComponent }             from './alert-dialog/alert-dialog.component'
import { MuDataTableComponent }             from './mu-data-table/mu-data-table.component'
import { FileUploadComponent }              from './file-upload/file-upload.component'

import { NcMaxLengthDirective,
         NcAutoFocusDirective, 
         LongPressDirective, 
         NcStyleClassDirective,
         NextInpFocusDirective,
         AdjustElementsDirective
       }                                    from './directives'

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
    MatSelectModule,
    MatAutocompleteModule,
    MatCheckboxModule,
    MatProgressBarModule,
    MatRadioModule,
    TableModule
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
    FilterComponent,
    InputContainerComponent,
    MuDataTableComponent,

    NcAutoFocusDirective,
    NcMaxLengthDirective,
    LongPressDirective, 
    NcStyleClassDirective,
    NextInpFocusDirective,
    AdjustElementsDirective,
  
    TranslatePipe,
  
    FileUploadComponent
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
    FilterComponent,
    InputContainerComponent,
    MuDataTableComponent,

    NcAutoFocusDirective,
    NcMaxLengthDirective,
    LongPressDirective, 
    NcStyleClassDirective,
    NextInpFocusDirective,
    AdjustElementsDirective,

    TranslatePipe,
    
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    FlexLayoutModule,
    MatRadioModule,
    MatProgressBarModule
    
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