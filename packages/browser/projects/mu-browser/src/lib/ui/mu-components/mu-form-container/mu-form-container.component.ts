/*------------------------------------------------------------------------------
   About      : Replacement of input-container. Ranges are not handled as of now
   
   Created on : Fri Mar 06 2020
   Author     : Aditya Baddur
   
   Copyright (c) 2020 Obopay. All rights reserved.

   https://developers.google.com/web/fundamentals/design-and-ux/input/forms/#recommended_input_name_and_autocomplete_attribute_values
------------------------------------------------------------------------------*/


import { Component,
         Input,
         Output,
         Inject,
         EventEmitter,
         ViewChild,
         OnChanges,
         ElementRef,
         ViewChildren,
         QueryList,
         ChangeDetectorRef
       }                                  from '@angular/core'
import { FormControl,
         Validators,
         FormGroup,
         FormBuilder
       }                                  from '@angular/forms'
import { TrackableScreen }                from '../../router/trackable-screen'
import { RunContextBrowser }              from '../../../rc-browser'
import { MatAutocompleteSelectedEvent }   from '@angular/material/autocomplete'
import { MatSelectChange }                from '@angular/material/select'
import { MatButtonToggleChange }          from '@angular/material/button-toggle'
import { MatDatepicker,
         MatDatepickerInputEvent
       }                                  from '@angular/material/datepicker'
import { MatCheckboxChange }              from '@angular/material/checkbox'
import { MatRadioChange }                 from '@angular/material/radio'
import { MatSlideToggleChange }           from '@angular/material/slide-toggle'

import { InputValidator }                 from '../input-container/input-validator'
import { Observable }                     from 'rxjs'
import { map,
         startWith
       }                                  from 'rxjs/operators'
import { FileUploadComponent, 
         UploadedDocParams 
       }                                  from '../file-upload/file-upload.component'
import { Mubble,
         DISPLAY_TYPE, 
         DISPLAY_MODE,
         InputParams,
         SelectionBoxParams,
         MuFormParams
       }                                  from '@mubble/core'
import { MuFormOutputParams, 
         FormOutputValue 
       }                                  from '../cmn-inp-cont/cmn-inp-cont-interfaces'

@Component({
  selector    : 'mu-form-container',
  templateUrl : './mu-form-container.component.html',
  styleUrls   : ['./mu-form-container.component.scss']
})

export class MuFormContainerComponent implements OnChanges {

  @ViewChildren(MatDatepicker) picker                             : QueryList<MatDatepicker<Date>>
  @ViewChild(FileUploadComponent, { static: false }) fileUplInst  : FileUploadComponent
  @ViewChildren('inputCont') inputCont                            : QueryList<ElementRef>

  @Input()  formParams      : MuFormParams
  @Input()  screen          : TrackableScreen
  @Input()  webMode         : boolean
  @Input()  parentCont      : ElementRef
  @Input()  eventPropagate  : boolean               = false
  @Input()  displayMode     : DISPLAY_MODE         
  @Input()  displayLabel    : boolean               = true
  @Input()  displayCount    : number   

  @Output() value           : EventEmitter<MuFormOutputParams>  = new EventEmitter<MuFormOutputParams>()
  @Output() dropdownOpen    : EventEmitter<boolean>             = new EventEmitter<boolean>()
  @Output() lastInpField    : EventEmitter<any>                 = new EventEmitter<any>()

  inputForm         : FormGroup = {} as FormGroup
  filteredOptions   : Observable<SelectionBoxParams[]>

  DISPLAY_TYPE      : typeof DISPLAY_TYPE       = DISPLAY_TYPE
  DISPLAY_MODE      : typeof DISPLAY_MODE       = DISPLAY_MODE
  maxDate           : Date                      = new Date()

  inputContainers : HTMLElement[]

  private fileUploadParams  : UploadedDocParams

  constructor(@Inject('RunContext') protected rc  : RunContextBrowser,
              private formBuilder                 : FormBuilder,
              private changeRef                   : ChangeDetectorRef) { 

    this.inputForm  = this.formBuilder.group({}) 
    
  }

  ngOnChanges() {
    this.initialize()
  }

  ngOnInit() {
    this.initialize() 
  }

  ngAfterViewInit() {

    setTimeout(() => {
      this.inputContainers  = this.inputCont.toArray().map(val => val.nativeElement)        
    }, 10)
    
  }

  /*=====================================================================
                              UTILS
  =====================================================================*/
  onSubmit(manual : boolean = true, id ?: string) {

    for (const inputParams of this.formParams.inputParams) {
    
      if (this.inputForm && (inputParams.validators || inputParams.isRequired) && manual)
        this.inputForm.get(inputParams.id).markAsTouched()
    }

    if (manual && this.hasError()) return false

    const formOutputParams  : MuFormOutputParams  = { } as MuFormOutputParams

    for (const inputParams of this.formParams.inputParams) {

      if (id && id !== inputParams.id) continue

      let params    : FormOutputValue
      
      switch (inputParams.displayType) {

        case DISPLAY_TYPE.CALENDAR_BOX        :
          params  = { 
                      value       : this.inputForm.get(inputParams.id).value ? this.inputForm.get(inputParams.id).value.getTime() : null,
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
        case DISPLAY_TYPE.TIME                :
          params  = { 
                      value       : this.inputForm.get(inputParams.id).value,
                      displayType : inputParams.displayType
                    }
          break

        case DISPLAY_TYPE.DATE_RANGE  :
          const dateFormGroup : FormGroup               = this.inputForm.get(inputParams.id) as FormGroup,
                dateRangeKeys : string[]                = inputParams.rangeKeys || ['startDate', 'endDate'],
                dateValue     : Mubble.uObject<string>  = {}

          dateValue[dateRangeKeys[0]] = dateFormGroup.controls.startDate.value
                                        ? dateFormGroup.controls.startDate.value.getTime()
                                        : null
      
          dateValue[dateRangeKeys[1]] = dateFormGroup.controls.endDate.value
                                        ? dateFormGroup.controls.endDate.value.getTime()
                                        : null                          
                                    

          params  = { 
                      value       : dateValue,
                      displayType : inputParams.displayType
                    }
          break

        case DISPLAY_TYPE.NUMBER_RANGE  :
          const numFormGroup  : FormGroup               = this.inputForm.get(inputParams.id) as FormGroup,
                numRangeKeys  : string[]                = inputParams.rangeKeys || ['minAmount', 'maxAmount'],
                numRangeValue : Mubble.uObject<string>  = {}


          numRangeValue[numRangeKeys[0]]  = numFormGroup.controls.minAmount.value,
          numRangeValue[numRangeKeys[1]]  = numFormGroup.controls.maxAmount.value     

          params  = { 
                      value       : numRangeValue,
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
    return true

  }

  isCalanderOpen() : boolean {
    const pickers = this.picker.toArray()
    return pickers.some(val => val.opened)
  }

  closeCalander() {
    const pickers = this.picker.toArray(),
          length  = pickers.length

    for (let i = 0 ; i < length; i++) {
      if (pickers[i].opened) {
        pickers[i].close()
        break
      }
    }
  }

  clearForm() {
    this.inputForm.reset()
  }
  /*=====================================================================
                              HTML
  =====================================================================*/

  selectedOption(event : MatSelectChange | MatRadioChange, i : number) {

    const inputParams = this.formParams.inputParams[i]
    this.inputForm.get(inputParams.id).setValue(event.value)

    if (this.eventPropagate)  this.onSubmit(false, inputParams.id)
  }

  onToggleChane(event : MatSlideToggleChange, i : number) {
    const inputParams = this.formParams.inputParams[i]
    this.inputForm.get(inputParams.id).setValue(event.checked)
    if (this.eventPropagate)  this.onSubmit(false, inputParams.id)
  }

  onBtnToggleChange(event : MatButtonToggleChange, i : number) {
    const inputParams = this.formParams.inputParams[i]
    this.inputForm.get(inputParams.id).setValue(event.value)
    if (this.eventPropagate)  this.onSubmit(false, inputParams.id)
  }

  fileUploadValue(event : UploadedDocParams, id : string) {
    this.fileUploadParams = event
    if (this.eventPropagate)  this.onSubmit(false, id)
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

    if (this.eventPropagate)  this.onSubmit(false, inputParams.id)
  }

  setChangedValues(event : string, i : number) {
    const inputParams = this.formParams.inputParams[i]
    this.inputForm.get(inputParams.id).setValue(event)

    if (this.eventPropagate)  this.onSubmit(false, inputParams.id)
  }

  setDate(event : MatDatepickerInputEvent<Date>, i : number) {
    const value : any = event.value,
          inputParams = this.formParams.inputParams[i]

    value && !this.isDateObj(value) ? this.inputForm.get(inputParams.id).setValue(value.toDate())
                                    : this.inputForm.get(inputParams.id).setValue(value)
    
    if (this.eventPropagate)  this.onSubmit(false, inputParams.id)
  }

  setDateRange(event : MatDatepickerInputEvent<Date>, i : number) {
    const formName  : string    = this.formParams.inputParams[i].id,
          dateGroup : FormGroup = this.inputForm.get(formName) as FormGroup

    const sDate = dateGroup.controls.startDate.value,
          eDate = dateGroup.controls.endDate.value

    sDate && !this.isDateObj(sDate) ? dateGroup.controls.startDate.setValue(sDate.toDate())
                                    : dateGroup.controls.startDate.setValue(sDate)

    eDate && !this.isDateObj(eDate) ? dateGroup.controls.endDate.setValue(eDate.toDate())
                                    : dateGroup.controls.endDate.setValue(eDate)

    if (this.eventPropagate)  this.onSubmit(false, formName)
  }

  setNumberRange(event : string, i : number) {
    const formName  : string    = this.formParams.inputParams[i].id,
          numGroup  : FormGroup = this.inputForm.get(formName) as FormGroup

    numGroup.controls.minAmount.setValue(numGroup.controls.minAmount.value)
    numGroup.controls.maxAmount.setValue(numGroup.controls.maxAmount.value)

    if (this.eventPropagate)  this.onSubmit(false, formName)
  }

  setAutocompleteValue(event : MatAutocompleteSelectedEvent, i : number) {
    const inputParams = this.formParams.inputParams[i]
    this.inputForm.get(inputParams.id).setValue(event.option.value)
    if (this.eventPropagate)  this.onSubmit(false, inputParams.id)
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
        case DISPLAY_TYPE.TIME                :

          hasError = inputParams.isRequired 
                    ? this.inputForm.invalid
                    : this.inputForm.get(inputParams.id).value && this.inputForm.invalid
          break

        case DISPLAY_TYPE.DATE_RANGE    :
          const dateFormGroup : FormGroup = this.inputForm.get(inputParams.id) as FormGroup

          hasError  = inputParams.isRequired 
                      ? dateFormGroup.invalid
                      : ((dateFormGroup.controls.startDate.value && dateFormGroup.controls.startDate.invalid)
                        || (dateFormGroup.controls.startDate.value && !dateFormGroup.controls.endDate.value)
                        || (dateFormGroup.controls.endDate.value && dateFormGroup.controls.endDate.invalid))
          break

        case DISPLAY_TYPE.NUMBER_RANGE  :
          const numFormGroup : FormGroup = this.inputForm.get(inputParams.id) as FormGroup

          hasError  = inputParams.isRequired 
                      ? numFormGroup.invalid
                      : ((numFormGroup.controls.minAmount.value && numFormGroup.controls.minAmount.invalid)
                        || (numFormGroup.controls.minAmount.value && !numFormGroup.controls.maxAmount.value) 
                        || (numFormGroup.controls.maxAmount.value && numFormGroup.controls.maxAmount.invalid))
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

  dropDownToggle(event : boolean, index : number) {

    const inputParams = this.formParams.inputParams[index]
    

    if (!event && this.inputForm.get(inputParams.id).value) {
      
      if (this.inputContainers[index + 1]) {
        this.inputContainers[index + 1].focus()
      } else {
        this.lastInpField.emit()
      }
    }
    
    this.dropdownOpen.emit(event)
  }

  valueEntered(value, i : number) {

    const inputParams = this.formParams.inputParams[i]
    if (inputParams.displayType === DISPLAY_TYPE.AUTOCOMPLETE_SELECT) {
      const option = inputParams.options.find(option => option.value === value)
    
      option  ? this.inputForm.get(inputParams.id).setValue(option)
              : this.inputForm.get(inputParams.id).setValue({ id : value, value : value })   

      if (this.eventPropagate)  this.onSubmit(false, inputParams.id)
    }
  }

  enterOnLastInput(event : any) {
    this.lastInpField.emit(event)
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
        case DISPLAY_TYPE.INPUT_BOX       :
        case DISPLAY_TYPE.TEXT_AREA       :
        case DISPLAY_TYPE.RADIO           : 
        case DISPLAY_TYPE.ROW_RADIO       :

        case DISPLAY_TYPE.SELECTION_BOX   :
        case DISPLAY_TYPE.TOGGLE          : 
        case DISPLAY_TYPE.MULTI_CHECK_BOX :
        case DISPLAY_TYPE.BUTTON_TOGGLE   :
        case DISPLAY_TYPE.ROW_INPUT_BOX   :
        case DISPLAY_TYPE.TIME            :

          this.inputForm.addControl(params.id, new FormControl(params.value || null, formValidations))

          if (params.options && params.options.length) {
            const selectedValues  = []
            params.options.forEach(opt => {
              if (opt.selected) selectedValues.push(opt)
            })
            if (selectedValues.length) this.inputForm.get(params.id).setValue(selectedValues[0])
          }
          this.setInputDisabled(params.id,params.isDisabled)
          break
    

        case DISPLAY_TYPE.AUTOCOMPLETE_SELECT :
          this.inputForm.addControl(params.id, new FormControl(params.value || null, formValidations))
          this.filteredOptions      = this.inputForm.valueChanges.pipe(
                                      startWith(''),
                                      map(value => typeof value === 'string' ? value : value.value),
                                      map(value => value  ? this.filterOptions(value, params)
                                                        : params.options.slice()))

          this.setInputDisabled(params.id,params.isDisabled)
          break

        case DISPLAY_TYPE.CALENDAR_BOX  :
          if (params.value) params.value = new Date(params.value)

          formValidations.push(InputValidator.futureDateValidator)

          this.inputForm.addControl(params.id, new FormControl(params.value || null, formValidations))
          this.setInputDisabled(params.id,params.isDisabled)
          break

        case DISPLAY_TYPE.DATE_RANGE  : 
          if (!params.value) params.value  = {}

          const valiArr = [InputValidator.dateValidator]
          if(!params.validators || !params.validators.allowFutureDate)
            valiArr.push(InputValidator.futureDateValidatorIfAllowed)

          this.inputForm.addControl(params.id, new FormGroup({
            startDate : new FormControl(params.value['startDate'] ? new Date(params.value.startDate)
                                                                  : null, formValidations),
            endDate   : new FormControl(params.value['endDate'] ? new Date(params.value.endDate)
                                                                : null, formValidations),
          },
          {
            validators : valiArr
          }))

          this.setInputDisabled(params.id,params.isDisabled)
          break

        case DISPLAY_TYPE.NUMBER_RANGE  : 
          if (!params.value) params.value  = {}

          this.inputForm.addControl(params.id, new FormGroup({
            minAmount : new FormControl(params.value['minAmount'] || null, formValidations),
            maxAmount : new FormControl(params.value['maxAmount'] || null, formValidations),
          },
          {
            validators : [InputValidator.amountValidator]
          }))

          this.setInputDisabled(params.id,params.isDisabled)
          break
      }
    }

    if (this.formParams.formValidators) this.inputForm.setValidators(this.formParams.formValidators.validation)

  }

  private filterOptions(inputText : string, params : InputParams): SelectionBoxParams[] {

    const filterValue = inputText.toLowerCase()
    return params.options.filter(option =>
      (option.value as string).toLowerCase().includes(filterValue))
  }

  private setInputDisabled(id : string, value : boolean) {
    value ? this.inputForm.get(id).disable() : this.inputForm.get(id).enable()
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

  /*=====================================================================
                              UTILS
  =====================================================================*/

  focusElement(index : number) {
    
    this.inputContainers[index].focus()

  }

  updateValidators(formIds : string[]) {

    for (let i = 0 ; i < formIds.length; i++) {

      const form = this.inputForm.get(formIds[i])

      if (form) {
        const params = this.formParams.inputParams.find(val => val.id === formIds[i])
        if (params) {
          if (params.isDisabled) {
            form.disable()
          } else {
            form.enable()
          }
        }
      }

    }
  }

}
