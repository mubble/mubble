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
import { MatCardModule }                    from '@angular/material/card'
import { MatDividerModule }                 from '@angular/material/divider'



import { MuComponentsRoutingModule }        from './ui/mu-components/mu-components-routing.module'

import { TRANSLATION_PROVIDERS }            from './ui/mu-components/translate/translations'
import { TranslatePipe }                    from './ui/mu-components/translate/translate.pipe'

import { CustomBreakPointsProvider }        from './ui/mu-components/custom-breakpoints'
import { NcAutoFocusDirective }             from './ui/mu-components/directives/nc-autofocus.directive'
import { NcMaxLengthDirective }             from './ui/mu-components/directives/nc-maxlength.directive'
import { LongPressDirective }               from './ui/mu-components/directives/longpress.directive'
import { NcStyleClassDirective }            from './ui/mu-components/directives/nc-style-class.directive'
import { AdjustElementsDirective }          from './ui/mu-components/directives/adjust-elements.directive'
import { NcFallbackCharDirective }          from './ui/mu-components/directives/nc-fallback-char.directive'
import { KeyboardDirective }                from './ui/mu-components/directives/keyboard.directive'
import { NextInpFocusDirective }            from './ui/mu-components/directives/next-inp-focus.directive'
import { NcAllowSingleClickDirective }      from './ui/mu-components/directives/nc-allow-single-click.directive'
import { NcImgFallbackDirective }           from './ui/mu-components/directives/nc-img-fallback.directive'
import { ValidateImgDirective }             from './ui/mu-components/directives/validate-img.directive'




import { GenericPipe }                      from './ui/mu-components/pipes/generic.pipe'
import { ExtractMobileNoPipe }              from './ui/mu-components/pipes/extract-mobile-no.pipe'
import { CurrencyPipe }                     from './ui/mu-components/pipes/currency.pipe'
import { AUDCurrencyPipe }                  from './ui/mu-components/pipes/audcurrency.pipe'

import { DropDownMultiSelectComponent }     from './ui/mu-components/drop-down-multi-select/drop-down-multi-select.component'
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


import { AlertDialogComponent }             from './ui/mu-components//alert-dialog/alert-dialog.component'
import { MuDataTableComponent }             from './ui/mu-components//mu-data-table/mu-data-table.component'
import { FileUploadComponent }              from './ui/mu-components//file-upload/file-upload.component'
import { KeypadComponent }                  from './ui/mu-components//keypad/keypad.component'
import { PageNotFoundComponent }            from './ui/mu-components//page-not-found/page-not-found.component'
import { MaskingValueDirective }            from './ui/mu-components//directives/masking-value.directive'

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
    MatDividerModule
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
    NcAllowSingleClickDirective,
    NcImgFallbackDirective,
    ValidateImgDirective,

    TranslatePipe,
    GenericPipe,
    CurrencyPipe,
    KeypadComponent,
    ExtractMobileNoPipe,
    AUDCurrencyPipe
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
    NcAllowSingleClickDirective,
    NcImgFallbackDirective,
    ValidateImgDirective,

    TranslatePipe,
    GenericPipe,
    ExtractMobileNoPipe,
    CurrencyPipe,
    AUDCurrencyPipe,

    //Angular imports
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    FlexLayoutModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatRadioModule,
    MatProgressBarModule,
    MatSliderModule,
    MatSlideToggleModule,
    MatButtonToggleModule,
    MatMenuModule,
    MatCardModule,
    MatDividerModule
  ],


  providers: [
    CustomBreakPointsProvider,
    TRANSLATION_PROVIDERS,
    // {provide: HAMMER_GESTURE_CONFIG, useClass: GestureConfig}
  ]
})


export class MuBrowserModule {
  static forRoot(): ModuleWithProviders<any> {
    return {
      ngModule: MuBrowserModule,
      providers: [
        TRANSLATION_PROVIDERS,
        // {provide: HAMMER_GESTURE_CONFIG, useClass: GestureConfig}
      ]
    }
  }
}
