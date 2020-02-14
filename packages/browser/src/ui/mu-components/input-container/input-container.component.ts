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
         OnChanges,
         ViewChildren,
         QueryList,
         ElementRef
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
         MatDatepicker,
         MatRadioChange,
         MatCheckboxChange,
         MatSlideToggleChange,
         MatCheckbox,
         MatButtonToggleChange,
         MatButtonToggle
       }                                  from '@angular/material'
import { Moment }                         from 'moment'
import { InputValidator }                 from './input-validator'
import { Observable }                     from 'rxjs'
import { map,
         startWith
       }                                  from 'rxjs/operators'
import { FileUploadComponent, 
         UploadedDocParams 
       }                                  from '../file-upload/file-upload.component'
import { DISPLAY_TYPE, 
         DISPLAY_MODE,
         InputParams,
         SelectionBoxParams
       }                                  from '@mubble/core/interfaces/app-server-interfaces'

export interface OutputParams {
  id          : string
  value       : any
  displayType : DISPLAY_TYPE
}

@Component({
  selector    : 'input-container',
  templateUrl : './input-container.component.html',
  styleUrls   : ['./input-container.component.scss']
})

export class InputContainerComponent implements OnChanges {

  @ViewChild(MatDatepicker, { static: false }) picker  : MatDatepicker<any>
  @ViewChild(FileUploadComponent, { static: false }) fileUplInst  : FileUploadComponent
  @ViewChildren(MatCheckbox) matCheckbox  : QueryList<MatCheckbox>
  @ViewChildren(MatButtonToggle) matBtnToggle  : QueryList<MatButtonToggle>


  @Input()  inputParams     : InputParams
  @Input()  screen          : TrackableScreen
  @Input()  webMode         : boolean
  @Input()  parentCont      : ElementRef
  @Input()  eventPropagate  : boolean               = false
  @Input()  displayMode     : DISPLAY_MODE         
  @Output() value           : EventEmitter<any>     = new EventEmitter<any>()
  @Output() dropdownOpen    : EventEmitter<boolean> = new EventEmitter<boolean>()

  inputForm       : FormControl
  dateRange       : FormGroup
  numberRange     : FormGroup
  filteredOptions : Observable<SelectionBoxParams[]>

  DISPLAY_TYPE      : typeof DISPLAY_TYPE       = DISPLAY_TYPE
  DISPLAY_MODE      : typeof DISPLAY_MODE       = DISPLAY_MODE

  private fileUploadParams : UploadedDocParams

  constructor(@Inject('RunContext') protected rc  : RunContextBrowser,
              private formBuilder                 : FormBuilder) { 

  }

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

    if (this.inputForm && (this.inputParams.validators || this.inputParams.isRequired))  this.inputForm.markAsTouched()

    if (this.dateRange && this.inputParams.validators) {
      this.dateRange.controls.startDate.markAsTouched()
      this.dateRange.controls.endDate.markAsTouched()
    }

    if (this.numberRange && this.inputParams.validators) {
      this.numberRange.controls.minAmount.markAsTouched()
      this.numberRange.controls.maxAmount.markAsTouched()
    }

    if (this.hasError()) return

    let params    : OutputParams,
        emitValue : boolean = true    
    
    switch (this.inputParams.displayType) {

      case DISPLAY_TYPE.CALENDAR_BOX        :
      case DISPLAY_TYPE.INPUT_BOX           :
      case DISPLAY_TYPE.SELECTION_BOX       :
      case DISPLAY_TYPE.AUTOCOMPLETE_SELECT :
      case DISPLAY_TYPE.TEXT_AREA           :
      case DISPLAY_TYPE.TOGGLE              :
      case DISPLAY_TYPE.BUTTON_TOGGLE       :
      case DISPLAY_TYPE.ROW_INPUT_BOX       :
        params = { 
                    id          : this.inputParams.id,
                    value       : this.inputForm.value,
                    displayType : this.inputParams.displayType
                 }
        break

      case DISPLAY_TYPE.DATE_RANGE  :
        params = { 
                    id          : this.inputParams.id,
                    value       : {
                                     startDate : this.dateRange.controls.startDate.value,
                                     endDate   : this.dateRange.controls.endDate.value
                                   },
                    displayType : this.inputParams.displayType

                 }
        break

      case DISPLAY_TYPE.NUMBER_RANGE  :
        params = { 
                    id     : this.inputParams.id,
                    value  : { 
                              minAmount : this.numberRange.controls.minAmount.value,
                              maxAmount : this.numberRange.controls.maxAmount.value
                            },
                    displayType : this.inputParams.displayType
                 }
        break

      case DISPLAY_TYPE.IMAGE_UPLOAD  : 
        params  = {
                    id          : this.inputParams.id,
                    value       : this.fileUploadParams,
                    displayType : this.inputParams.displayType
                  }
        break

      case DISPLAY_TYPE.RADIO :
        params = {
                    id          : this.inputParams.id,
                    value       : this.inputForm.value ? this.inputForm.value['id'] : null,
                    displayType : this.inputParams.displayType
                 }
        break

      case DISPLAY_TYPE.MULTI_CHECK_BOX :  

        // const matCheckboxInst = this.matCheckbox.toArray(),
        //       values = []

        // matCheckboxInst.forEach((val,index) => {
        //   if (val.checked) values.push(val.value)
        // })

        params = { 
          id          : this.inputParams.id,
          value       : this.inputForm.value,
          displayType : this.inputParams.displayType
        }
        break  

    } 
    
    if (emitValue) this.value.emit(params)
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
  selectedOption(event : MatSelectChange | MatRadioChange) {
    this.inputForm.setValue(event.value)
    if (this.eventPropagate)  this.onSubmit()
  }

  onToggleChane(event : MatSlideToggleChange) {
    
    this.inputForm.setValue(event.checked)
    if (this.eventPropagate)  this.onSubmit()
  }

  onBtnToggleChange(event : MatButtonToggleChange, index : number) {
    this.inputForm.setValue(event.value)
    if (this.eventPropagate)  this.onSubmit()
  }

  fileUploadValue(event : UploadedDocParams) {
    this.fileUploadParams = event
    if (this.eventPropagate)  this.onSubmit()
  }

  checkedOption(event : MatCheckboxChange, option : SelectionBoxParams) {
    this.inputForm.setValue({checked : event.checked, option})
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
      case DISPLAY_TYPE.TEXT_AREA           :
      case DISPLAY_TYPE.MULTI_CHECK_BOX     :
      case DISPLAY_TYPE.RADIO               :
      case DISPLAY_TYPE.TOGGLE              :
      case DISPLAY_TYPE.BUTTON_TOGGLE       :
      case DISPLAY_TYPE.ROW_INPUT_BOX   :

        hasError = this.inputParams.isRequired 
                   ? this.inputForm.invalid
                   : this.inputForm.value && this.inputForm.invalid
        break

      case DISPLAY_TYPE.DATE_RANGE    :
        if (this.inputParams.isRequired) {
          hasError  = this.dateRange.controls.startDate.invalid || this.dateRange.controls.endDate.invalid
        } else {
          hasError  = (this.dateRange.controls.startDate.value && this.dateRange.controls.startDate.invalid)
                      || ( this.dateRange.controls.startDate.value && !this.dateRange.controls.endDate.value || (
                        this.dateRange.controls.endDate.value && this.dateRange.controls.endDate.invalid))

        }
        break

      case DISPLAY_TYPE.NUMBER_RANGE  :
        hasError = this.inputParams.isRequired 
                   ? this.numberRange.controls.minAmount.invalid 
                   : this.numberRange.controls.minAmount.value && this.numberRange.controls.minAmount.invalid

        break

      case DISPLAY_TYPE.IMAGE_UPLOAD  :
        this.fileUplInst.onSubmit()
        hasError  = this.inputParams.isRequired ? (!this.fileUploadParams || Object.keys(this.fileUploadParams).length === 0) : false
    }
  
    return hasError
  }

  dropDownToggle(event : boolean) {
    this.dropdownOpen.emit(event)
  }

  valueEntered(value) {
    if (this.inputParams.displayType === DISPLAY_TYPE.AUTOCOMPLETE_SELECT) {
      const option = this.inputParams.options.find(option => option.value === value)
    
      option ? this.inputForm.setValue(option) : this.inputForm.setValue({ id : value , value : value})   
      if (this.eventPropagate)  this.onSubmit()
    }
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
      case DISPLAY_TYPE.TEXT_AREA     :
      case DISPLAY_TYPE.RADIO         : 
      case DISPLAY_TYPE.SELECTION_BOX :
      case DISPLAY_TYPE.TOGGLE        : 
      case DISPLAY_TYPE.MULTI_CHECK_BOX :
      case DISPLAY_TYPE.BUTTON_TOGGLE   :
      case DISPLAY_TYPE.ROW_INPUT_BOX :
        this.inputForm  = new FormControl(params.value || null, formValidations)
        this.setDisabled(params.isDisabled)
        break

      case DISPLAY_TYPE.AUTOCOMPLETE_SELECT :
        this.inputForm  = new FormControl(params.value || null, formValidations)
        this.filteredOptions = this.inputForm.valueChanges.pipe(
                                 startWith(''),
                                 map(value => typeof value === 'string' ? value : value.value),
                                 map(value => value ? this.filterOptions(value)
                                                    : this.inputParams.options.slice()))
        this.setDisabled(params.isDisabled)
        break

      case DISPLAY_TYPE.CALENDAR_BOX  :
        formValidations.push(InputValidator.futureDateValidator)
        this.inputForm  = new FormControl(params.value || null, formValidations)
        this.setDisabled(params.isDisabled)
        break

      case DISPLAY_TYPE.DATE_RANGE    : 
        this.dateRange = this.formBuilder.group({
          startDate : [params.value['startDate'] || null, formValidations],
          endDate   : [params.value['endDate']   || null, formValidations]
        }
       )
        const valiArr = [InputValidator.dateValidator]
        if(!params.validators || !params.validators.allowFutureDate) 
          valiArr.push(InputValidator.futureDateValidatorIfAllowed)
        this.dateRange.setValidators(valiArr)
        if (params.isDisabled) this.dateRange.disable()
        break

      case DISPLAY_TYPE.NUMBER_RANGE  : 
        this.numberRange = this.formBuilder.group({
          minAmount : [params.value['minAmount'] || null, formValidations],
          maxAmount : [params.value['maxAmount'] || null, formValidations]
        },
        {
          validator : [InputValidator.amountValidator]
        })
        if (params.isDisabled) this.numberRange.disable()
        break
    }

  }

  private filterOptions(inputText : string): SelectionBoxParams[] {
    const filterValue = inputText.toLowerCase()
    return this.inputParams.options.filter(option => option.value.toLowerCase().includes(filterValue))
  }

  private setDisabled(value : boolean) {
    value ? this.inputForm.disable() : this.inputForm.enable()
  }
}