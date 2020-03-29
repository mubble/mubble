import { NgModule,
         ModuleWithProviders
       }                                    from '@angular/core'
import { FormsModule,
         ReactiveFormsModule 
       }                                    from '@angular/forms'
import { CommonModule }                     from '@angular/common'
import { FlexLayoutModule }                 from '@angular/flex-layout'
import { MatRippleModule }                  from '@angular/material'

import { MatCheckboxModule }                from '@angular/material/checkbox'
import { MatDatepickerModule }              from '@angular/material/datepicker'
import { MatFormFieldModule }               from '@angular/material/form-field'
import { MatInputModule }                   from '@angular/material/input'
import { MatSelectModule }                  from '@angular/material/select'
import { MatAutocompleteModule }            from '@angular/material/autocomplete'
import { MatRadioModule }                   from '@angular/material/radio'
import { MatProgressBarModule }             from '@angular/material/progress-bar'
import { MatSliderModule }                  from '@angular/material/slider'
import { MatSlideToggleModule }             from '@angular/material/slide-toggle'
import { MatButtonToggleModule }            from '@angular/material/button-toggle'
import { MatMenuModule }                    from '@angular/material/menu'


import { MuComponentsRoutingModule }        from './mu-components-routing.module'

import { TRANSLATION_PROVIDERS,
         TranslateService,
         TranslatePipe
       }                                    from './translate'
         
import { CustomBreakPointsProvider }        from './custom-breakpoints'

import { NcMaxLengthDirective,
         NcAutoFocusDirective, 
         LongPressDirective, 
         NcStyleClassDirective,
         NextInpFocusDirective,
         AdjustElementsDirective,
         NcFallbackCharDirective,
         KeyboardDirective
       }                                    from './directives'
import { GenericPipe }                      from './pipes'
import { BottomInComponent }                from './bottom-in/bottom-in.component'
import { ModalPopupComponent }              from './modal-popup/modal-popup.component'
import { LoadingComponent }                 from './loading/loading.component'
import { LoadingErrorComponent }            from './loading/loading-error/loading-error.component'
import { LoadingOverlayComponent }          from './loading/loading-overlay/loading-overlay.component'
import { ToastComponent }                   from './toast/toast.component'
import { InfiniteScrollComponent }          from './infinite-scroll/infinite-scroll.component'
import { FilterComponent }                  from './filter/filter.component'
import { InputContainerComponent}           from './input-container/input-container.component'
import { DialerComponent }                  from './dialer/dialer.component'
import { MuFormContainerComponent }         from './mu-form-container/mu-form-container.component'


import { AlertDialogComponent }             from './alert-dialog/alert-dialog.component'
import { MuDataTableComponent }             from './mu-data-table/mu-data-table.component'
import { FileUploadComponent }              from './file-upload/file-upload.component'
import { MatCardModule }                    from '@angular/material'
import { KeypadComponent }                  from './keypad/keypad.component' 
import { PageNotFoundComponent }            from './page-not-found/page-not-found.component'


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
    MatSliderModule,
    MatSlideToggleModule,
    MatButtonToggleModule,
    MatMenuModule,
    MatCardModule,
    MatRippleModule
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
    DialerComponent,
    FileUploadComponent,
    MuFormContainerComponent,
    PageNotFoundComponent,

    NcAutoFocusDirective,
    NcMaxLengthDirective,
    LongPressDirective, 
    NcStyleClassDirective,
    NextInpFocusDirective,
    AdjustElementsDirective,
    NcFallbackCharDirective,
    KeyboardDirective,
  
    TranslatePipe,
    GenericPipe,
    KeypadComponent
  ],

  entryComponents : [
    AlertDialogComponent,
    KeypadComponent
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
    DialerComponent,
    KeypadComponent,
    MuFormContainerComponent,
    PageNotFoundComponent,

    NcAutoFocusDirective,
    NcMaxLengthDirective,
    LongPressDirective, 
    NcStyleClassDirective,
    NextInpFocusDirective,
    AdjustElementsDirective,
    NcFallbackCharDirective,
    KeyboardDirective,

    TranslatePipe,
    GenericPipe,
    
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    FlexLayoutModule,
    MatRadioModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatButtonToggleModule,
    MatMenuModule,
    MatRippleModule
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