import { Component,
         Input,
         Output,
         Inject,
         EventEmitter
       }                          from '@angular/core'
import { FormControl,
         Validators
       }                          from '@angular/forms'
import { TrackableScreen }        from '../../../ui/router/trackable-screen'
import { RunContextBrowser }      from '../../../rc-browser'
import { MatSelectChange,
         MatDatepickerInputEvent
       }                          from '@angular/material'
import { Moment }                 from 'moment'

export enum DISPLAY_TYPE {
  INPUT_BOX     = 'INPUT_BOX',
  SELECTION_BOX = 'SELECTION_BOX',
  CALENDAR_BOX  = 'CALENDAR_BOX',
  DATE_RANGE    = 'DATE_RANGE',
  NUMBER_RANGE  = 'NUMBER_RANGE'
}

export interface SelectionBoxParams {
  id    : string
  value : string
}

export interface ValidatorsParams {
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
  label         : string
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

export class InputContainerComponent {

  @Input()  inputParams : InputParams
  @Input()  screen      : TrackableScreen   
  @Output() value       : EventEmitter<any> = new EventEmitter<any>()

  inputForm     : FormControl
  startDate     : FormControl
  endDate       : FormControl
  minAmount     : FormControl
  maxAmount     : FormControl
  
  futureDateErr   : boolean = false
  startDateErr    : boolean = false
  noStartDateErr  : boolean = false
  minAmountErr    : boolean = false
  noMinAmountErr  : boolean = false
  formError       : boolean = false
  
  DISPLAY_TYPE  : typeof DISPLAY_TYPE = DISPLAY_TYPE

  constructor(@Inject('RunContext') protected rc  : RunContextBrowser) { }

  ngOnInit() {

    const params          = this.inputParams,
          formValidations = []

    if (params.isRequired) {
      formValidations.push(Validators.required)
    }

    if (params.validators) {
      formValidations.push(Validators.pattern(params.validators.validation))
    }

    switch (params.displayType) {
      case DISPLAY_TYPE.CALENDAR_BOX  :
      case DISPLAY_TYPE.INPUT_BOX     :
      case DISPLAY_TYPE.SELECTION_BOX :
        this.inputForm  = new FormControl(params.value || '', formValidations)
        break

      case DISPLAY_TYPE.DATE_RANGE    : 
        this.startDate  = new FormControl(params.value['startDate'] || '', formValidations)
        this.endDate    = new FormControl(params.value['endDate']   || '', formValidations)
        break

      case DISPLAY_TYPE.NUMBER_RANGE  : 
        this.minAmount  = new FormControl(params.value['minAmount'] || '', formValidations)
        this.maxAmount  = new FormControl(params.value['maxAmount'] || '', formValidations)
        break
    }
  }


  /*=====================================================================
                              UTILS
  =====================================================================*/
  onSubmit() {

    if (this.inputParams.validators)  this.inputForm.markAsTouched()

    if (this.formError) return

    let params : OutputParams

    switch (this.inputParams.displayType) {

      case DISPLAY_TYPE.CALENDAR_BOX  :
      case DISPLAY_TYPE.INPUT_BOX     :
      case DISPLAY_TYPE.SELECTION_BOX :

        params = { id     : this.inputParams.id,
                   value  : this.inputForm.value }
        break

      case DISPLAY_TYPE.DATE_RANGE    :

        params = { id     : this.inputParams.id,
                   value  : { startDate : this.startDate.value,
                              endDate   : this.endDate.value }
                 }
        break

      case DISPLAY_TYPE.NUMBER_RANGE  :

        params = { id     : this.inputParams.id,
                   value  : { minAmount : +this.minAmount.value,
                              maxAmount : +this.maxAmount.value }
                 }
        break
    }
    
    this.value.emit(params)
  }

  /*=====================================================================
                              HTML
  =====================================================================*/
  selectedOption(event : MatSelectChange) {

    this.formError = false

    if (this.inputForm.invalid) {
      this.formError = true
      return
    }

    this.inputForm.setValue(event.value)
  }

  setChangedValues(event : string) {

    this.formError = false

    if (this.inputForm.invalid) {
      this.formError = true
      return
    }

    this.inputForm.setValue(event)
  }

  setDate(event : MatDatepickerInputEvent<Moment>) {
    
    this.futureDateErr = false
    this.formError     = false
    
    const dateTs    = event.value.toDate().getTime()

    if (Date.now() - dateTs < 0 ) {
      this.futureDateErr = true
      return
    }

    if (this.inputForm.invalid) {
      this.formError = true
      return
    }

    this.inputForm.setValue(event.value)
  }

  setDateRange(event : MatDatepickerInputEvent<Moment>) {

    this.formError      = false
    this.futureDateErr  = false
    this.startDateErr   = false
    this.noStartDateErr = false

    const startDateTs = this.startDate.value ? this.startDate.value.toDate().getTime() : null,
          endDateTs   = this.endDate.value   ? this.endDate.value.toDate().getTime()   : null,
          dateNowTs   = Date.now()

    if ((endDateTs - startDateTs < 0) && endDateTs && startDateTs) {
      this.formError    = true
      this.startDateErr = true
      return
    }

    if (!startDateTs && endDateTs) {
      this.formError      = true
      this.noStartDateErr = true
      return
    }

    if ((dateNowTs - endDateTs) < 0 || (dateNowTs - startDateTs) < 0) {
      this.formError      = true
      this.futureDateErr  = true
      return
    }

    this.startDate.setValue(this.startDate.value)
    this.endDate.setValue(this.endDate.value)
  }

  setNumberRange(event : string) {

    this.formError      = false
    this.minAmountErr   = false
    this.noMinAmountErr = false

    const minAmount = this.minAmount.value ? this.minAmount.value : null,
          maxAmount = this.maxAmount.value ? this.maxAmount.value : null

    if ((maxAmount - minAmount < 0) && minAmount && maxAmount) {
      this.formError    = true
      this.minAmountErr = true
      return
    }

    if (!minAmount && maxAmount) {
      this.formError      = true
      this.noMinAmountErr = true
      return
    }

    this.minAmount.setValue(this.minAmount.value)
    this.maxAmount.setValue(this.maxAmount.value)
  }

}