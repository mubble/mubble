/*------------------------------------------------------------------------------
   About          : Child component which has individual control for each input
                    type
   
   Created on     : Fri May 24 2019
   Author         : Pulkit Chaturvedi
   Last edited by : Divya Sinha
   
   Copyright (c) 2019 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { Component,
         Input,
         Output,
         Inject,
         EventEmitter,
         ViewChild,
         OnChanges
       }                                  from '@angular/core'
import { FormControl,
         Validators,
         FormGroup,
         FormBuilder
       }                                  from '@angular/forms'
import { TrackableScreen }                from '../../../ui/router/trackable-screen'
import { RunContextBrowser }              from '../../../rc-browser'
import { MatSelectChange,
         MatDatepickerInputEvent,
         MatAutocompleteSelectedEvent,
         MatDatepicker
       }                                  from '@angular/material'
import { Moment }                         from 'moment'
import { InputValidator }                 from './input-validator'
import { Observable }                     from 'rxjs'
import { map,
         startWith
       }                                  from 'rxjs/operators'

export enum DISPLAY_TYPE {
  INPUT_BOX             = 'INPUT_BOX',
  SELECTION_BOX         = 'SELECTION_BOX',
  CALENDAR_BOX          = 'CALENDAR_BOX',
  DATE_RANGE            = 'DATE_RANGE',
  NUMBER_RANGE          = 'NUMBER_RANGE',
  AUTOCOMPLETE_SELECT   = 'AUTO_COMPLETE_SELECT'
}

export interface SelectionBoxParams {
  id    : string
  value : string
}

export interface ValidatorsParams {
  allowFutureDate ?: boolean
  validation      ?: string | RegExp
  validationError  : string
}

export interface OutputParams {
  id    : string
  value : any
}

export interface InputParams {
  id            : string
  displayType   : DISPLAY_TYPE
  placeHolder   : string | string[]
  label        ?: string
  options      ?: SelectionBoxParams[]
  inputType    ?: string
  maxLength    ?: number
  value        ?: any
  isPassword   ?: boolean
  validators   ?: ValidatorsParams
  isRequired   ?: boolean
}

@Component({
  selector    : 'input-container',
  templateUrl : './input-container.component.html',
  styleUrls   : ['./input-container.component.scss']
})

export class InputContainerComponent implements OnChanges {

  @ViewChild(MatDatepicker, { static: false }) picker  : MatDatepicker<any>

  @Input()  inputParams     : InputParams
  @Input()  screen          : TrackableScreen
  @Input()  webMode         : boolean
  @Input()  eventPropagate  : boolean               = false
  @Output() value           : EventEmitter<any>     = new EventEmitter<any>()
  @Output() dropdownOpen    : EventEmitter<boolean> = new EventEmitter<boolean>()

  inputForm       : FormControl
  dateRange       : FormGroup
  numberRange     : FormGroup
  filteredOptions : Observable<SelectionBoxParams[]>

  DISPLAY_TYPE  : typeof DISPLAY_TYPE = DISPLAY_TYPE

  constructor(@Inject('RunContext') protected rc  : RunContextBrowser,
              private formBuilder                 : FormBuilder) { }

  ngOnChanges() {
    this.initialize()
  }

  ngOnInit() {
    this.initialize()      
  }

  /*=====================================================================
                              UTILS
  =====================================================================*/
  onSubmit() {

    if (this.inputForm && this.inputParams.validators)  this.inputForm.markAsTouched()

    if (this.dateRange && this.inputParams.validators) {
      this.dateRange.controls.startDate.markAsTouched()
      this.dateRange.controls.endDate.markAsTouched()
    }

    if (this.numberRange && this.inputParams.validators) {
      this.numberRange.controls.minAmount.markAsTouched()
      this.numberRange.controls.maxAmount.markAsTouched()
    }

    if (this.hasError()) return

    let params : OutputParams

    switch (this.inputParams.displayType) {

      case DISPLAY_TYPE.CALENDAR_BOX        :
      case DISPLAY_TYPE.INPUT_BOX           :
      case DISPLAY_TYPE.SELECTION_BOX       :
      case DISPLAY_TYPE.AUTOCOMPLETE_SELECT :
        params = { id     : this.inputParams.id,
                   value  : this.inputForm.value }
        break

      case DISPLAY_TYPE.DATE_RANGE  :
        params = { id     : this.inputParams.id,
                   value  : {
                              startDate : this.dateRange.controls.startDate.value,
                              endDate   : this.dateRange.controls.endDate.value
                            }
                 }
        break

      case DISPLAY_TYPE.NUMBER_RANGE  :
        params = { id     : this.inputParams.id,
                   value  : { 
                              minAmount : this.numberRange.controls.minAmount.value,
                              maxAmount : this.numberRange.controls.maxAmount.value
                            }
                 }
        break
    }

    this.value.emit(params)
  }

  isCalanderOpen() : boolean {
    return this.picker.opened
  }

  closeCalander() {
    this.picker.close()
  }

  /*=====================================================================
                              HTML
  =====================================================================*/
  selectedOption(event : MatSelectChange) {
    this.inputForm.setValue(event.value)
    if (this.eventPropagate)  this.onSubmit()
  }

  setChangedValues(event : string) {
    this.inputForm.setValue(event)
    if (this.eventPropagate)  this.onSubmit()
  }

  setDate(event : MatDatepickerInputEvent<Moment>) {
    this.inputForm.setValue(event.value)
    if (this.eventPropagate)  this.onSubmit()
  }

  setDateRange(event : MatDatepickerInputEvent<Moment>) {
    this.dateRange.controls.startDate.setValue(this.dateRange.controls.startDate.value)
    this.dateRange.controls.endDate.setValue(this.dateRange.controls.endDate.value)
    if (this.eventPropagate)  this.onSubmit()
  }

  setNumberRange(event : string) {
    this.numberRange.controls.minAmount.setValue(this.numberRange.controls.minAmount.value)
    this.numberRange.controls.maxAmount.setValue(this.numberRange.controls.maxAmount.value)
    if (this.eventPropagate)  this.onSubmit()
  }

  setAutocompleteValue(event : MatAutocompleteSelectedEvent) {
    this.inputForm.setValue(event.option.value)
    if (this.eventPropagate)  this.onSubmit()
  }

  displayFn(value: any) : string {
    return value && typeof value === 'object' ? value.value : value
  }

  hasError() : boolean {
    let hasError : boolean = false

    switch (this.inputParams.displayType) {

      case DISPLAY_TYPE.CALENDAR_BOX        :
      case DISPLAY_TYPE.INPUT_BOX           :
      case DISPLAY_TYPE.SELECTION_BOX       :
      case DISPLAY_TYPE.AUTOCOMPLETE_SELECT :

        hasError = this.inputParams.isRequired 
                   ? this.inputForm.invalid
                   : this.inputForm.value && this.inputForm.invalid
        break

      case DISPLAY_TYPE.DATE_RANGE    :
        if (this.inputParams.isRequired) {
          hasError  = this.dateRange.controls.startDate.invalid || this.dateRange.controls.endDate.invalid
        } else {
          hasError = this.dateRange.controls.endDate.value && this.dateRange.controls.endDate.invalid
          hasError = this.dateRange.controls.startDate.value && this.dateRange.controls.startDate.invalid
        }
        break

      case DISPLAY_TYPE.NUMBER_RANGE  :
        hasError = this.inputParams.isRequired 
                   ? this.numberRange.controls.minAmount.invalid 
                   : this.numberRange.controls.minAmount.value && this.numberRange.controls.minAmount.invalid

        break
    }

    return hasError
  }

  dropDownToggle(event : boolean) {
    this.dropdownOpen.emit(event)
  }

  /*=====================================================================
                              PRIVATE
  =====================================================================*/
  private initialize() {
    const params          = this.inputParams,
          formValidations = []

    if (params.isRequired) {
      formValidations.push(Validators.required)
    }

    if (params.validators) {
      formValidations.push(Validators.pattern(params.validators.validation))
    }

    switch (params.displayType) {
      case DISPLAY_TYPE.INPUT_BOX     :
      case DISPLAY_TYPE.SELECTION_BOX :
        this.inputForm  = new FormControl(params.value || null, formValidations)
        break

      case DISPLAY_TYPE.AUTOCOMPLETE_SELECT :
        this.inputForm  = new FormControl(params.value || null, formValidations)
        this.filteredOptions = this.inputForm.valueChanges.pipe(
                                 startWith(''),
                                 map(value => typeof value === 'string' ? value : value.value),
                                 map(value => value ? this.filterOptions(value) : this.inputParams.options.slice()))
        break

      case DISPLAY_TYPE.CALENDAR_BOX  :
        formValidations.push(InputValidator.futureDateValidator)
        this.inputForm  = new FormControl(params.value || null, formValidations)
        break

      case DISPLAY_TYPE.DATE_RANGE    : 
        this.dateRange = this.formBuilder.group({
          startDate : [params.value['startDate'] || null, formValidations],
          endDate   : [params.value['endDate']   || null, formValidations]
        }
       )
        const valiArr = [InputValidator.dateValidator]
        if(!params.validators.allowFutureDate) 
          valiArr.push(InputValidator.futureDateValidatorIfAllowed)
        this.dateRange.setValidators(valiArr)
        break

      case DISPLAY_TYPE.NUMBER_RANGE  : 
        this.numberRange = this.formBuilder.group({
          minAmount : [params.value['minAmount'] || null, formValidations],
          maxAmount : [params.value['maxAmount'] || null, formValidations]
        },
        {
          validator : [InputValidator.amountValidator]
        })
        break
    }
  }

  private filterOptions(inputText : string): SelectionBoxParams[] {
    const filterValue = inputText.toLowerCase()
    return this.inputParams.options.filter(option => option.value.toLowerCase().includes(filterValue))
  }
}