/*------------------------------------------------------------------------------
   About      : Generic component for filtering which can either be date,
                date-range, dropdown list, number, number-range or text 
                search
   
   Created on : Tue Jun 11 2019
   Author     : Divya Sinha
   
   Copyright (c) 2019 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { InputContainerComponent }    from '..'
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
         DISPLAY_MODE, 
         FilterItem,
         MuSelectedFilter,
         FILTER_MODE
       }                              from '@mubble/core'
import { OutputParams }               from '../cmn-inp-cont'

enum CONTEXT {
  INIT,
  CLEAR,
  UPDATE
}

export interface SelectedFilter {
  id           : string
  mode         : FILTER_MODE
  value        : any
  displayType ?: DISPLAY_TYPE
}

export interface DateRangeInterface { 
  startDate  : number
  endDate   ?: number
}

export interface NumberRangeInterface {
  minAmount  : number
  maxAmount ?: number
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
  @Input()  webMode         : boolean           = false   //if we want to use filter component as full page
  @Input()  displayCount    : number            = 1
  @Input()  displayMode     : DISPLAY_MODE      = DISPLAY_MODE.HORIZONTAL

  @Output() selectedFilter  : EventEmitter<MuSelectedFilter[]> = new EventEmitter<MuSelectedFilter[]>()

  filters      : MuSelectedFilter[]   = []
  DISPLAY_MODE : typeof DISPLAY_MODE  = DISPLAY_MODE
  filterChips  : string[]             = []

  constructor(@Inject('RunContext') protected rc  : RunContextBrowser) { }

  ngOnInit() {
    this.initialize(CONTEXT.INIT)
  }

  /*=====================================================================
                              UTILS
  =====================================================================*/

  public updateLastAppliedFilters(lastFilters : FilterItem[]) {
    this.filterItems = lastFilters
    this.initialize(CONTEXT.UPDATE)
  }

  /*=====================================================================
                                  HTML
  =====================================================================*/
  applyFilters() {
    
    this.filterChips = []

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
    const inputContInstances = this.inputContInstances.toArray()

    inputContInstances.forEach(inputContInstance => {
      inputContInstance.onSubmit()
    })

    this.initialize(CONTEXT.CLEAR)
    this.filterChips = []
    this.selectedFilter.emit(undefined)   //on clearing, we just return undefined
  }

  setFilterItems(event : OutputParams) {

    this.setFilterChips(event)

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
      const index = this.filters.findIndex(element => element.id === fItem.params.id)
      let changed : boolean = false
      
      //checking if the previous filter value has changed or not according to the display type
      switch(fItem.params.displayType) {

        case DISPLAY_TYPE.CALENDAR_BOX        :
        case DISPLAY_TYPE.INPUT_BOX           :
        case DISPLAY_TYPE.SELECTION_BOX       :
        case DISPLAY_TYPE.ROW_INPUT_BOX       :
        case DISPLAY_TYPE.MULTI_CHECK_BOX     :
        case DISPLAY_TYPE.RADIO               :
        case DISPLAY_TYPE.AUTOCOMPLETE_SELECT :
        case DISPLAY_TYPE.SLIDER              : 
          (!fItem.params.value && !this.filters[index].value)
          ? changed = false
          : changed = fItem.params.value !== this.filters[index].value
          break

        case DISPLAY_TYPE.DATE_RANGE    :
          ((!fItem.params.value['startDate'] && !this.filters[index].value['startDate']) &&
          (!fItem.params.value['endDate'] && !this.filters[index].value['endDate']))
          ? changed = false
          : changed = (fItem.params.value['startDate'] !== this.filters[index].value['startDate']) ||
                      (fItem.params.value['endDate'] !== this.filters[index].value['endDate'])
          break

        case DISPLAY_TYPE.NUMBER_RANGE  :
          ((!fItem.params.value['minAmount'] && !this.filters[index].value['minAmount']) &&
          (!fItem.params.value['maxAmount'] && !this.filters[index].value['maxAmount']))
          ? changed = false
          : changed = (fItem.params.value['minAmount'] !== this.filters[index].value['minAmount']) ||
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
        this.filters.push({ id : fItem.params.id, value : fItem.params.value, mode : fItem.mode, displayType : fItem.params.displayType })
      }
    } else if (context === CONTEXT.CLEAR) {
      this.filters      = []
      const fItems : FilterItem[] = []

      for (const fItem of this.filterItems) {
        const setNull = fItem.params.displayType === DISPLAY_TYPE.DATE_RANGE
                        ? { startDate : null, endDate : null }
                        : fItem.params.displayType === DISPLAY_TYPE.NUMBER_RANGE
                        ? { minAmount : null, maxAmount : null }
                        : null

        fItem.params.value  = setNull

        fItems.push({
          params  : fItem.params,
          mode    : fItem.mode
        })

        this.filters.push({ id : fItem.params.id, value : setNull, mode : fItem.mode, displayType : fItem.params.displayType })
        
      }

      this.filterItems  = []
      this.filterItems  = fItems
    } else {
      const fItems  : FilterItem[]        = [],
            filters : MuSelectedFilter[]  = []

      for (const fItem of this.filterItems) {

        const currentValue  = this.filters.find(val => val.id === fItem.params.id && fItem.params.value)
        fItem.params.value  = currentValue ? currentValue.value : null

        fItems.push({
          params  : fItem.params,
          mode    : fItem.mode,
        })

        filters.push({ id : fItem.params.id, value : fItem.params.value, mode : fItem.mode, displayType : fItem.params.displayType })
      }

      this.filterItems  = []
      this.filterItems  = fItems
      this.filters      = filters
      
    }
  }

  private setFilterChips(event : OutputParams) {

    switch(event.displayType) {

      case DISPLAY_TYPE.CALENDAR_BOX  :
        //Do we need it?
        break

      case DISPLAY_TYPE.INPUT_BOX     :
      case DISPLAY_TYPE.ROW_INPUT_BOX :
        if (event.value) this.filterChips.push(event.value)
        break

      case DISPLAY_TYPE.MULTI_CHECK_BOX :

        if (event.value) {

          const checkboxValues  = event.value

          checkboxValues.forEach(val => {
            this.filterChips.push(val.value)
          })

        }

        break

      case DISPLAY_TYPE.SELECTION_BOX       :
      case DISPLAY_TYPE.RADIO               :
      case DISPLAY_TYPE.AUTOCOMPLETE_SELECT :
      case DISPLAY_TYPE.SLIDER              : 
        if (event.value) this.filterChips.push(event.value.value)
        break

      case DISPLAY_TYPE.DATE_RANGE  :
        //Do we need it?
        break

      case DISPLAY_TYPE.NUMBER_RANGE  :
        //Do we need it?
        break


    }

  }

}