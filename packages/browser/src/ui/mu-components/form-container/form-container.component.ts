/*------------------------------------------------------------------------------
   About      : Replacement of input-container
   
   Created on : Fri Mar 06 2020
   Author     : Aditya Baddur
   
   Copyright (c) 2020 Obopay. All rights reserved.
------------------------------------------------------------------------------*/


import { Component,
         Input,
         Output,
         Inject,
         EventEmitter,
         ViewChild,
         OnChanges,
         ElementRef
       }                                  from '@angular/core'
import { FormControl,
         Validators,
         FormGroup,
         FormBuilder
       }                                  from '@angular/forms'
import { TrackableScreen }                from '../../router/trackable-screen'
import { RunContextBrowser }              from '../../../rc-browser'
import { MatSelectChange,
         MatDatepickerInputEvent,
         MatAutocompleteSelectedEvent,
         MatDatepicker,
         MatRadioChange,
         MatCheckboxChange,
         MatSlideToggleChange,
         MatButtonToggleChange,
         MatSelect
       }                                  from '@angular/material'
import { InputValidator }                 from '../input-container/input-validator'
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
         SelectionBoxParams,
         FormParams
       }                                  from '@mubble/core/interfaces/app-server-interfaces'
import { FormOutputParams, 
         FormOutputValue 
       }                                  from '../cmn-inp-cont/cmn-inp-cont-interfaces'

@Component({
  selector    : 'form-container',
  templateUrl : './form-container.component.html',
  styleUrls   : ['./form-container.component.scss']
})

export class FormContainerComponent implements OnChanges {

  @ViewChild(MatDatepicker, { static: false }) picker             : MatDatepicker<any>
  @ViewChild(FileUploadComponent, { static: false }) fileUplInst  : FileUploadComponent
  @ViewChild(MatSelect, { static : false}) matSelect              : MatSelect

  @Input()  formParams      : FormParams
  @Input()  screen          : TrackableScreen
  @Input()  webMode         : boolean
  @Input()  parentCont      : ElementRef
  @Input()  eventPropagate  : boolean               = false
  @Input()  displayMode     : DISPLAY_MODE         
  @Input()  displayLabel    : boolean               = true

  @Output() value           : EventEmitter<FormOutputParams>  = new EventEmitter<FormOutputParams>()
  @Output() dropdownOpen    : EventEmitter<boolean>         = new EventEmitter<boolean>()

  inputForm       : FormGroup = {} as FormGroup
  dateRange       : FormGroup
  numberRange     : FormGroup
  filteredOptions : Observable<SelectionBoxParams[]>

  DISPLAY_TYPE      : typeof DISPLAY_TYPE       = DISPLAY_TYPE
  DISPLAY_MODE      : typeof DISPLAY_MODE       = DISPLAY_MODE

  private fileUploadParams : UploadedDocParams

  constructor(@Inject('RunContext') protected rc  : RunContextBrowser,
              private formBuilder                 : FormBuilder) { 

    this.inputForm  = this.formBuilder.group({}) 
    
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

    for (const inputParams of this.formParams.inputParams) {
    
      if (this.inputForm && (inputParams.validators || inputParams.isRequired))
        this.inputForm.get(inputParams.id).markAsTouched()

      if (this.dateRange && inputParams.validators) {
        this.dateRange.controls.startDate.markAsTouched()
        this.dateRange.controls.endDate.markAsTouched()
      }

      if (this.numberRange && inputParams.validators) {
        this.numberRange.controls.minAmount.markAsTouched()
        this.numberRange.controls.maxAmount.markAsTouched()
      }
    }

    if (this.hasError()) return

    const formOutputParams  : FormOutputParams  = { } as FormOutputParams

    for (const inputParams of this.formParams.inputParams) {

      let params    : FormOutputValue
      
      switch (inputParams.displayType) {

        case DISPLAY_TYPE.CALENDAR_BOX        :
          params  = { 
                      value       : this.inputForm.get(inputParams.id).value.getTime(),
                      displayType : inputParams.displayType
                    }
          break

        case DISPLAY_TYPE.INPUT_BOX           :
        case DISPLAY_TYPE.SELECTION_BOX       :
        case DISPLAY_TYPE.AUTOCOMPLETE_SELECT :
        case DISPLAY_TYPE.TEXT_AREA           :
        case DISPLAY_TYPE.TOGGLE              :
        case DISPLAY_TYPE.BUTTON_TOGGLE       :
        case DISPLAY_TYPE.ROW_INPUT_BOX       :
          params  = { 
                      value       : this.inputForm.get(inputParams.id).value,
                      displayType : inputParams.displayType
                    }
          break

        case DISPLAY_TYPE.DATE_RANGE  :
          params  = { 
                      value       : {
                                      startDate : this.dateRange.controls.startDate.value
                                                  ? this.dateRange.controls.startDate.value.getTime()
                                                  : null,
                                      endDate   : this.dateRange.controls.endDate.value
                                                  ? this.dateRange.controls.endDate.value.getTime()
                                                  : null
                                    },
                      displayType : inputParams.displayType
                    }
          break

        case DISPLAY_TYPE.NUMBER_RANGE  :
          params  = { 
                      value       : { 
                                      minAmount : this.numberRange.controls.minAmount.value,
                                      maxAmount : this.numberRange.controls.maxAmount.value
                                    },
                      displayType : inputParams.displayType
                    }
          break

        case DISPLAY_TYPE.IMAGE_UPLOAD  : 
          params  = {
                      value       : this.fileUploadParams,
                      displayType : inputParams.displayType
                    }
          break

        case DISPLAY_TYPE.RADIO     : 
        case DISPLAY_TYPE.ROW_RADIO :

          params  = {
                      value       : this.inputForm.get(inputParams.id).value ||  null,
                      displayType : inputParams.displayType
                    }
          break

        case DISPLAY_TYPE.MULTI_CHECK_BOX :  
          params  = { 
                      value       : this.inputForm.get(inputParams.id).value,
                      displayType : inputParams.displayType
                    }
          break  

      }
      
      formOutputParams[inputParams.id]  = params

    }

    this.value.emit(formOutputParams)

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
  selectedOption(event : MatSelectChange | MatRadioChange, i : number) {
    const inputParams = this.formParams.inputParams[i]
    this.inputForm.get(inputParams.id).setValue(event.value)
    if (this.eventPropagate)  this.onSubmit()
  }

  onToggleChane(event : MatSlideToggleChange, i : number) {
    const inputParams = this.formParams.inputParams[i]
    this.inputForm.get(inputParams.id).setValue(event.checked)
    if (this.eventPropagate)  this.onSubmit()
  }

  onBtnToggleChange(event : MatButtonToggleChange, i : number) {
    const inputParams = this.formParams.inputParams[i]
    this.inputForm.get(inputParams.id).setValue(event.value)
    if (this.eventPropagate)  this.onSubmit()
  }

  fileUploadValue(event : UploadedDocParams) {
    this.fileUploadParams = event
    if (this.eventPropagate)  this.onSubmit()
  }

  checkedOption(event : MatCheckboxChange, option : SelectionBoxParams, i : number) {

    const inputParams = this.formParams.inputParams[i],
          value       = this.inputForm.get(inputParams.id).value as any[]
          

    if (value) {

      const idIndex = value.findIndex(val => val.id === option.id)

      if (idIndex !== -1) {
        value.splice(idIndex, 1)
        this.inputForm.get(inputParams.id).setValue(value)
      } else {
        value.push(option)
        this.inputForm.get(inputParams.id).setValue(value)
      }

    } else {
      this.inputForm.get(inputParams.id).setValue([option])
    }

    if (this.eventPropagate)  this.onSubmit()
  }

  setChangedValues(event : string, i : number) {
    const inputParams = this.formParams.inputParams[i]
    this.inputForm.get(inputParams.id).setValue(event)
    if (this.eventPropagate)  this.onSubmit()
  }

  setDate(event : MatDatepickerInputEvent<Date>, i : number) {
    const value : any = event.value,
          inputParams = this.formParams.inputParams[i]

    value && !this.isDateObj(value) ? this.inputForm.get(inputParams.id).setValue(value.toDate())
                                    : this.inputForm.get(inputParams.id).setValue(value)
    
    if (this.eventPropagate)  this.onSubmit()
  }

  setDateRange(event : MatDatepickerInputEvent<Date>, i : number) {
    const sDate = this.dateRange.controls.startDate.value,
          eDate = this.dateRange.controls.endDate.value

    sDate && !this.isDateObj(sDate) ? this.dateRange.controls.startDate.setValue(sDate.toDate())
                                    : this.dateRange.controls.startDate.setValue(sDate)

    eDate && !this.isDateObj(eDate) ? this.dateRange.controls.endDate.setValue(eDate.toDate())
                                    : this.dateRange.controls.endDate.setValue(eDate)

    if (this.eventPropagate)  this.onSubmit()
  }

  setNumberRange(event : string, i : number) {
    this.numberRange.controls.minAmount.setValue(this.numberRange.controls.minAmount.value)
    this.numberRange.controls.maxAmount.setValue(this.numberRange.controls.maxAmount.value)

    if (this.eventPropagate)  this.onSubmit()
  }

  setAutocompleteValue(event : MatAutocompleteSelectedEvent, i : number) {
    const inputParams = this.formParams.inputParams[i]
    this.inputForm.get(inputParams.id).setValue(event.option.value)
    if (this.eventPropagate)  this.onSubmit()
  }

  displayFn(value: any) : string {
    return value && typeof value === 'object' ? value.value : value
  }

  hasError() : boolean {

    let hasError : boolean = false

    for (const inputParams of this.formParams.inputParams) {

      switch (inputParams.displayType) {

        case DISPLAY_TYPE.CALENDAR_BOX        :
        case DISPLAY_TYPE.INPUT_BOX           :
        case DISPLAY_TYPE.SELECTION_BOX       :
        case DISPLAY_TYPE.AUTOCOMPLETE_SELECT :
        case DISPLAY_TYPE.TEXT_AREA           :
        case DISPLAY_TYPE.MULTI_CHECK_BOX     :
        case DISPLAY_TYPE.RADIO               :
        case DISPLAY_TYPE.ROW_RADIO           :
        case DISPLAY_TYPE.TOGGLE              :
        case DISPLAY_TYPE.BUTTON_TOGGLE       :
        case DISPLAY_TYPE.ROW_INPUT_BOX       :

          hasError = inputParams.isRequired 
                    ? this.inputForm.invalid
                    : this.inputForm.get(inputParams.id).value && this.inputForm.invalid
          break

        case DISPLAY_TYPE.DATE_RANGE    :
          hasError  = inputParams.isRequired 
                      ? this.dateRange.invalid
                      : ((this.dateRange.controls.startDate.value && this.dateRange.controls.startDate.invalid )
                        || (this.dateRange.controls.startDate.value && !this.dateRange.controls.endDate.value)
                        || ( this.dateRange.controls.endDate.value && this.dateRange.controls.endDate.invalid) )
          break

        case DISPLAY_TYPE.NUMBER_RANGE  :
          hasError  = inputParams.isRequired 
                      ? this.numberRange.invalid
                      : ((this.numberRange.controls.minAmount.value && this.numberRange.controls.minAmount.invalid )
                        || ( this.numberRange.controls.minAmount.value && !this.numberRange.controls.maxAmount.value ) 
                        || (this.numberRange.controls.maxAmount.value && this.numberRange.controls.maxAmount.invalid) )
          break

        case DISPLAY_TYPE.IMAGE_UPLOAD  :
          this.fileUplInst.onSubmit()
          hasError  = inputParams.isRequired
                      ? (!this.fileUploadParams || Object.keys(this.fileUploadParams).length === 0)
                      : false
      }
    }
    
    return hasError
  }

  dropDownToggle(event : boolean) {
    this.dropdownOpen.emit(event)
  }

  valueEntered(value, i : number) {

    const inputParams = this.formParams.inputParams[i]
    if (inputParams.displayType === DISPLAY_TYPE.AUTOCOMPLETE_SELECT) {
      const option = inputParams.options.find(option => option.value === value)
    
      option  ? this.inputForm.get(inputParams.id).setValue(option)
              : this.inputForm.get(inputParams.id).setValue({ id : value, value : value })   

      if (this.eventPropagate)  this.onSubmit()
    }
  }

  /*=====================================================================
                              PRIVATE
  =====================================================================*/

  private initialize() {

    for (const params of this.formParams.inputParams) {
      const formValidations = []
       
      if (params.isRequired) formValidations.push(Validators.required)

      if (params.validators) formValidations.push(Validators.pattern(params.validators.validation))

      switch (params.displayType) {
        case DISPLAY_TYPE.INPUT_BOX     :
        case DISPLAY_TYPE.TEXT_AREA     :
        case DISPLAY_TYPE.RADIO         : 
        case DISPLAY_TYPE.ROW_RADIO     :

        case DISPLAY_TYPE.SELECTION_BOX :
        case DISPLAY_TYPE.TOGGLE        : 
        case DISPLAY_TYPE.MULTI_CHECK_BOX :
        case DISPLAY_TYPE.BUTTON_TOGGLE   :
        case DISPLAY_TYPE.ROW_INPUT_BOX :

          this.inputForm.addControl(params.id, new FormControl(params.value || null, formValidations) )

          if (params.options && params.options.length) {
            const selectedValues  = []
            params.options.forEach(opt => {
              if (opt.selected) selectedValues.push(opt)
            })
            if (selectedValues.length) this.inputForm.setValue(selectedValues)
          }
          this.setDisabled(params.isDisabled)
          break
    

        case DISPLAY_TYPE.AUTOCOMPLETE_SELECT :
          this.inputForm.addControl(params.id, new FormControl(params.value || null, formValidations) )
          this.filteredOptions      = this.inputForm.valueChanges.pipe(
                                      startWith(''),
                                      map(value => typeof value === 'string' ? value : value.value),
                                      map(value => value  ? this.filterOptions(value, params)
                                                        : params.options.slice()))

          this.setDisabled(params.isDisabled)
          break

        case DISPLAY_TYPE.CALENDAR_BOX  :
          if (params.value) params.value = new Date(params.value)

          formValidations.push(InputValidator.futureDateValidator)

          this.inputForm.addControl(params.id, new FormControl(params.value || null, formValidations) )
          this.setDisabled(params.isDisabled)
          break

        case DISPLAY_TYPE.DATE_RANGE    : 
          if (params.value) {

            if (params.value.startDate) params.value.startDate = new Date(params.value.startDate)
            if (params.value.endDate) params.value.endDate = new Date(params.value.endDate)
          } else {
            params.value  = {}
          }

          this.dateRange = this.formBuilder.group({
            startDate : [params.value['startDate'] || null, formValidations],
            endDate   : [params.value['endDate']   || null, formValidations]
          })

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

    if (this.formParams.formValidators) this.inputForm.setValidators(this.formParams.formValidators.validation)

  }

  private filterOptions(inputText : string, params : InputParams): SelectionBoxParams[] {

    const filterValue = inputText.toLowerCase()
    return params.options.filter(option =>
      option.value.toLowerCase().includes(filterValue))
  }

  private setDisabled(value : boolean) {
    value ? this.inputForm.disable() : this.inputForm.enable()
  }


  private isDateObj(value : any) : boolean {
    let isDate : boolean

    switch (typeof value) {
      case "string" : isDate = !isNaN(Date.parse(value))
                      break

      case "object" : isDate  = value instanceof Date
                                ? !isNaN(value.getTime())
                                : false
                      break

      default       : isDate = false
    }

    return isDate
  }
}