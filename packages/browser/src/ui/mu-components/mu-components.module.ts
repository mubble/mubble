import { NgModule,
         ModuleWithProviders
       }                                    from '@angular/core'

import { CommonModule }                     from '@angular/common'

import { FormsModule,
         ReactiveFormsModule 
       }                                    from '@angular/forms'
import { FlexLayoutModule }                 from '@angular/flex-layout'
import { MatDatepickerModule }              from '@angular/material/datepicker'
import { MatFormFieldModule }               from '@angular/material/form-field'
import { MatInputModule }                   from '@angular/material/input'
import { MatSelectModule }                  from '@angular/material/select'
import { MatAutocompleteModule }            from '@angular/material/autocomplete'
import { MatRadioModule }                   from '@angular/material/radio'
import { MatProgressBarModule }             from '@angular/material/progress-bar'

import { BottomInComponent }                from './bottom-in/bottom-in.component'
import { ModalPopupComponent }              from './modal-popup/modal-popup.component'
import { MuComponentsRoutingModule }        from './mu-components-routing.module'

import { LoadingComponent }                 from './loading/loading.component'
import { LoadingErrorComponent }            from './loading/loading-error/loading-error.component'
import { LoadingOverlayComponent }          from './loading/loading-overlay/loading-overlay.component'
import { ToastComponent }                   from './toast/toast.component'
import { InfiniteScrollComponent }          from './infinite-scroll/infinite-scroll.component'
import { FilterComponent }                  from './filter/filter.component'
import { InputContainerComponent}           from './input-container/input-container.component'

import { AlertDialogComponent }             from './alert-dialog/alert-dialog.component'
import { NcMaxLengthDirective,
         NcAutoFocusDirective, 
         LongPressDirective, 
         NcStyleClassDirective,
         NextInpFocusDirective,
         AdjustElementsDirective
       }                                    from './directives'
import { TRANSLATION_PROVIDERS,
         TranslateService,
         TranslatePipe }                    from './translate'
import { CustomBreakPointsProvider }        from './custom-breakpoints'
import { MuDataTableComponent }             from './mu-data-table/mu-data-table.component'
import { TableModule }                      from 'primeng/table'
import { MatCheckboxModule }                from '@angular/material'
import { FileUploadComponent }              from './file-upload/file-upload.component'


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