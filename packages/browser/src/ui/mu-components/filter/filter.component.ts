/*------------------------------------------------------------------------------
   About      : Generic component for filtering which can either be date,
                date-range, dropdown list, number, number-range or text 
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
import { DISPLAY_TYPE }               from '../input-container'

enum CONTEXT {
  INIT,
  CLEAR
}

export interface FilterItem {
  id      : string
  title   : string
  params  : InputParams
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

  @Input()  filterItems     : FilterItem[]      = []
  @Input()  screen          : TrackableScreen
  @Input()  webMode        ?: boolean           = false   //if we want to use filter component as full page

  @Output() selectedFilter  : EventEmitter<SelectedFilter[]> = new EventEmitter<SelectedFilter[]>()

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
      this.selectedFilter.emit([])  //empty array indicates that the previous filters and current filters are same
      return
    }

    this.selectedFilter.emit(this.filters)
  }

  clearFilters() {
    this.initialize(CONTEXT.CLEAR)
    this.selectedFilter.emit(undefined)   //on clearing, we just return undefined
  }

  setFilterItems(event : OutputParams) {
    const index = this.filters.findIndex(element => element.id === event.id)
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
      const index = this.filters.findIndex(element => element.id === fItem.id)
      let changed : boolean = false

      //checking changed value according to the display type
      switch(fItem.params.displayType) {
        case DISPLAY_TYPE.CALENDAR_BOX        :
        case DISPLAY_TYPE.INPUT_BOX           :
        case DISPLAY_TYPE.SELECTION_BOX       :
        case DISPLAY_TYPE.AUTOCOMPLETE_SELECT :
          changed = fItem.params.value !== this.filters[index].value
          break

        case DISPLAY_TYPE.DATE_RANGE    :
          changed = (fItem.params.value['startDate'] !== this.filters[index].value['startDate']) ||
                    (fItem.params.value['endDate'] !== this.filters[index].value['endDate'])
          break

        case DISPLAY_TYPE.NUMBER_RANGE  :
          changed = (fItem.params.value['minAmount'] !== this.filters[index].value['minAmount']) ||
                    (fItem.params.value['maxAmount'] !== this.filters[index].value['maxAmount'])
          break
      }

      if (changed)  return changed
    }

    return false
  }

  private initialize (context : CONTEXT) {

    if (context === CONTEXT.INIT) {
      for (const fItem of this.filterItems) {
        this.filters.push({ id : fItem.id, value : fItem.params.value })
  
        this.inputParams.push(fItem.params)
      }
    } else {
      this.inputParams  = []
      this.filters      = []

      for (const fItem of this.filterItems) {
        const setNull = fItem.params.displayType === DISPLAY_TYPE.DATE_RANGE
                        ? { startDate : null, endDate : null }
                        : fItem.params.displayType === DISPLAY_TYPE.NUMBER_RANGE
                        ? { minAmount : null, maxAmount : null }
                        : null

        this.filters.push({ id : fItem.id, value : setNull })
  
        this.inputParams.push(fItem.params)
      }
    }
  }
}