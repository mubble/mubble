import { NgModule,
         ModuleWithProviders
       }                                    from '@angular/core'
import { FormsModule,
         ReactiveFormsModule
       }                                    from '@angular/forms'
import { CommonModule }                     from '@angular/common'
import { FlexLayoutModule }                 from '@angular/flex-layout'
import { MatRippleModule }                  from '@angular/material/core'

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


import { MuComponentsRoutingModule }        from './ui/mu-components/mu-components-routing.module'

import { TRANSLATION_PROVIDERS,
         TranslateService,
         TranslatePipe,
         getTranslationProviders
       }                                    from './ui'

import { CustomBreakPointsProvider }        from './ui/mu-components/custom-breakpoints'

import { NcMaxLengthDirective,
         NcAutoFocusDirective,
         LongPressDirective,
         NcStyleClassDirective,
         NextInpFocusDirective,
         AdjustElementsDirective,
         NcFallbackCharDirective,
         KeyboardDirective
       }                                    from './ui/mu-components/directives'
import { GenericPipe }                      from './ui/mu-components/pipes'
import { BottomInComponent }                from './ui/mu-components/bottom-in/bottom-in.component'
import { ModalPopupComponent }              from './ui/mu-components/modal-popup/modal-popup.component'
import { LoadingComponent }                 from './ui/mu-components/loading/loading.component'
import { LoadingErrorComponent }            from './ui/mu-components/loading/loading-error/loading-error.component'
import { LoadingOverlayComponent }          from './ui/mu-components/loading/loading-overlay/loading-overlay.component'
import { ToastComponent }                   from './ui/mu-components/toast/toast.component'
import { InfiniteScrollComponent }          from './ui/mu-components/infinite-scroll/infinite-scroll.component'
import { FilterComponent }                  from './ui/mu-components/filter/filter.component'
import { InputContainerComponent}           from './ui/mu-components/input-container/input-container.component'
import { DialerComponent }                  from './ui/mu-components/dialer/dialer.component'
import { MuFormContainerComponent }         from './ui/mu-components/mu-form-container/mu-form-container.component'


import { AlertDialogComponent }             from './ui/mu-components/alert-dialog/alert-dialog.component'
import { MuDataTableComponent }             from './ui/mu-components/mu-data-table/mu-data-table.component'
import { FileUploadComponent }              from './ui/mu-components/file-upload/file-upload.component'
import { MatCardModule }                    from '@angular/material/card'
import { KeypadComponent }                  from './ui/mu-components/keypad/keypad.component'
import { PageNotFoundComponent }            from './ui/mu-components/page-not-found/page-not-found.component'
import { DropDownMultiSelectComponent }     from './ui/mu-components/drop-down-multi-select/drop-down-multi-select.component'
import { HAMMER_GESTURE_CONFIG }            from '@angular/platform-browser'
// import { GestureConfig }                    from '@angular/material'
import { MaskingValueDirective }            from './ui/mu-components/directives/masking-value.directive'

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
    MatRippleModule,
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
    DropDownMultiSelectComponent,

    NcAutoFocusDirective,
    NcMaxLengthDirective,
    LongPressDirective,
    NcStyleClassDirective,
    NextInpFocusDirective,
    AdjustElementsDirective,
    NcFallbackCharDirective,
    KeyboardDirective,
    MaskingValueDirective,

    TranslatePipe,
    GenericPipe,
    KeypadComponent
  ],

  entryComponents : [
    AlertDialogComponent,
    KeypadComponent
  ],

  exports: [
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
    DropDownMultiSelectComponent,

    NcAutoFocusDirective,
    NcMaxLengthDirective,
    LongPressDirective,
    NcStyleClassDirective,
    NextInpFocusDirective,
    AdjustElementsDirective,
    NcFallbackCharDirective,
    KeyboardDirective,
    MaskingValueDirective,

    TranslatePipe,
    GenericPipe
  ],

  providers: [
    CustomBreakPointsProvider,
    // {provide: HAMMER_GESTURE_CONFIG, useClass: GestureConfig}
  ]
})


export class MuBrowserModule {
  static forRoot(dictionary): ModuleWithProviders<MuBrowserModule> {
    return {
      ngModule: MuBrowserModule,
      providers: [
        getTranslationProviders(dictionary),
        TranslateService,
        // {provide: HAMMER_GESTURE_CONFIG, useClass: GestureConfig}
      ]
    }
  }
}
