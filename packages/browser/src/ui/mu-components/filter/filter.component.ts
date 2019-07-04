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
import { DISPLAY_TYPE }               from '../input-container'

export enum FILTER_TYPE {
  DATE,
  DATE_RANGE,
  DROP_DOWN,
  NUMBER,
  NUMBER_RANGE,
  TEXT
}

export interface FilterItem {
  id            : string
  label         : string
  type          : FILTER_TYPE
  displayType   : DISPLAY_TYPE
  value        ?: SelectionBoxParams[]
  defaultValue  : DateRangeInterface | NumberRangeInterface | string | number | SelectionBoxParams
  placeHolder   : string[] | string
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

  @Output() selectedFilter  : EventEmitter<SelectedFilter[]> = new EventEmitter<SelectedFilter[]>()

  FILTER_TYPE : typeof FILTER_TYPE = FILTER_TYPE

  filters     : SelectedFilter[] = []
  inputParams : InputParams[]    = []

  constructor(@Inject('RunContext') protected rc  : RunContextBrowser) { }

  ngOnInit() {

    for ( let fItem of this.filterItems) {
      this.filters.push({ id : fItem.id, value : fItem.defaultValue })

      this.inputParams.push({ id          : fItem.id,
                              displayType : fItem.displayType,
                              placeHolder : fItem.placeHolder,
                              label       : fItem.label,
                              options     : fItem.value,
                              value       : fItem.defaultValue })
    }
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

    this.selectedFilter.emit(this.filters)
  }

  clearFilters() {
    this.selectedFilter.emit(undefined)
  }

  /*=====================================================================
                                UTILS
  =====================================================================*/

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
      return inputContInstance.formError
    })
  }
}