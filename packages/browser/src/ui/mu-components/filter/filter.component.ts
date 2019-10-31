/*------------------------------------------------------------------------------
   About      : Generic component for filtering transactions which can either be
                date, date-range, dropdown list, number, number-range or text 
                search
   
   Created on : Tue Jun 11 2019
   Author     : Divya Sinha
   
   Copyright (c) 2019 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { SelectionBoxParams,
         InputContainerComponent,
         InputParams,
         OutputParams
       }                              from '..'
import { Moment }                     from 'moment'
import { Component,
         ViewChildren,
         QueryList,
         Input,
         Output,
         Inject,
         EventEmitter
       }                              from '@angular/core'
import { TrackableScreen }            from '../../../ui/router/trackable-screen'
import { RunContextBrowser }          from '../../../rc-browser'
import { DISPLAY_TYPE,
         ValidatorsParams
       }                              from '../input-container'

export enum FILTER_TYPE {
  DATE,
  DATE_RANGE,
  DROP_DOWN,
  NUMBER,
  NUMBER_RANGE,
  TEXT
}

enum CONTEXT {
  INIT,
  CLEAR
}

export interface FilterItem {
  id            : string
  label         : string
  type          : FILTER_TYPE
  displayType   : DISPLAY_TYPE
  value        ?: SelectionBoxParams[]
  defaultValue  : DateRangeInterface | NumberRangeInterface | string | number | SelectionBoxParams
  placeHolder   : string[] | string
  validators   ?: ValidatorsParams
  isRequired   ?: boolean
}


export interface DateRangeInterface { 
  startDate  : Moment
  endDate   ?: Moment
}

export interface NumberRangeInterface {
  minAmount  : number
  maxAmount ?: number
}

export interface SelectedFilter {
  id    : string
  value : DateRangeInterface | NumberRangeInterface | string | number | SelectionBoxParams
}

@Component({
  selector    : 'filter',
  templateUrl : './filter.component.html',
  styleUrls   : ['./filter.component.scss']
})

export class FilterComponent {

  @ViewChildren('inputCont') inputContInstances : QueryList<InputContainerComponent>

  @Input()  filterItems     : FilterItem[] = []
  @Input()  screen          : TrackableScreen
  @Input()  webMode        ?: boolean      = false

  @Output() selectedFilter  : EventEmitter<SelectedFilter[]> = new EventEmitter<SelectedFilter[]>()

  FILTER_TYPE : typeof FILTER_TYPE = FILTER_TYPE

  filters     : SelectedFilter[] = []
  inputParams : InputParams[]    = []

  constructor(@Inject('RunContext') protected rc  : RunContextBrowser) { }

  ngOnInit() {
    this.initialize(CONTEXT.INIT)
  }

  /*=====================================================================
                                  HTML
  =====================================================================*/
  applyFilters() {
    const inputContInstances = this.inputContInstances.toArray()

    inputContInstances.forEach(inputContInstance => {
      inputContInstance.onSubmit()
    })

    if (this.hasError()) return
    
    if (!this.valueChanged()) {
      this.selectedFilter.emit([])
      return
    }

    this.selectedFilter.emit(this.filters)
  }

  clearFilters() {
    this.initialize(CONTEXT.CLEAR)
    this.selectedFilter.emit(undefined)
  }

  getFilterItems(event : OutputParams) {

    const index = this.filters.findIndex(x => x.id === event.id)
    this.filters[index].value = event.value
  }

  /*=====================================================================
                                  PRIVATE
  =====================================================================*/

  private hasError() {
    const inputContInstances = this.inputContInstances.toArray()

    return inputContInstances.some(inputContInstance => {
      return inputContInstance.hasError()
    })
  }

  private valueChanged() : boolean {
    for (const fItem of this.filterItems) {
      const index = this.filters.findIndex(x => x.id === fItem.id)
      let changed : boolean = false

      switch(fItem.displayType) {
        case DISPLAY_TYPE.CALENDAR_BOX        :
        case DISPLAY_TYPE.INPUT_BOX           :
        case DISPLAY_TYPE.SELECTION_BOX       :
        case DISPLAY_TYPE.AUTOCOMPLETE_SELECT :
          changed = fItem.defaultValue !== this.filters[index].value
          break

        case DISPLAY_TYPE.DATE_RANGE    :
          changed = (fItem.defaultValue['startDate'] !== this.filters[index].value['startDate']) ||
                    (fItem.defaultValue['endDate'] !== this.filters[index].value['endDate'])
          break

        case DISPLAY_TYPE.NUMBER_RANGE  :
          changed = (fItem.defaultValue['minAmount'] !== this.filters[index].value['minAmount']) ||
                    (fItem.defaultValue['maxAmount'] !== this.filters[index].value['maxAmount'])
          break
      }

      if (changed)  return changed
    }

    return false
  }

  private initialize (context : CONTEXT) {
    if (context === CONTEXT.INIT) {
      for (const fItem of this.filterItems) {
        this.filters.push({ id : fItem.id, value : fItem.defaultValue })
  
        this.inputParams.push({ id          : fItem.id,
                                displayType : fItem.displayType,
                                placeHolder : fItem.placeHolder,
                                label       : fItem.label,
                                options     : fItem.value,
                                value       : fItem.defaultValue,
                                validators  : fItem.validators,
                                isRequired  : fItem.isRequired })
      }
    } else {
      this.inputParams  = []
      this.filters      = []

      for (const fItem of this.filterItems) {
        const setNull = fItem.displayType === DISPLAY_TYPE.DATE_RANGE
                        ? { startDate : null, endDate : null }
                        : fItem.displayType === DISPLAY_TYPE.NUMBER_RANGE
                        ? { minAmount : null, maxAmount : null }
                        : null

        this.filters.push({ id : fItem.id, value : setNull })
  
        this.inputParams.push({ id          : fItem.id,
                                displayType : fItem.displayType,
                                placeHolder : fItem.placeHolder,
                                label       : fItem.label,
                                options     : fItem.value,
                                value       : setNull,
                                validators  : fItem.validators,
                                isRequired  : fItem.isRequired })
      }
    }
  }
}