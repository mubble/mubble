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
         FILTER_MODE,
         StepSelectedFilter
       }                              from '@mubble/core'
import { OutputParams }               from '../cmn-inp-cont'
import { TranslateService } from '../translate/translate.service'


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

  @Input()  filterItems         : FilterItem[]      = []
  @Input()  screen              : TrackableScreen
  @Input()  webMode             : boolean           = false   //if we want to use filter component as full page
  @Input()  displayCount        : number            = 1
  @Input()  displayMode         : DISPLAY_MODE      = DISPLAY_MODE.HORIZONTAL
  @Input()  applyBtnTitle       : string

  @Output() selectedFilter      : EventEmitter<MuSelectedFilter[]> = new EventEmitter<MuSelectedFilter[]>()
  @Output() stepSelectedFilter  : EventEmitter<StepSelectedFilter>  = new EventEmitter<StepSelectedFilter>()

  filters      : MuSelectedFilter[]   = []
  DISPLAY_MODE : typeof DISPLAY_MODE  = DISPLAY_MODE
  filterChips  : string[]             = []
  applyBtnText : string

  constructor(@Inject('RunContext') protected rc  : RunContextBrowser,
              private translate : TranslateService) { }

  ngOnInit() {
    this.applyBtnText = this.applyBtnTitle ? this.applyBtnTitle 
                                           : this.translate.instant('mu_fltr_aply_fltr')
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

  onFilterSelected(event: StepSelectedFilter) {
    this.stepSelectedFilter.emit(event)
  }

  resetFilters(filterItems : FilterItem[]) {

    for (const fItem of filterItems) {
      const currentIdx = this.filterItems.findIndex(val => val.params.id === fItem.params.id)
      if (currentIdx == -1) continue
      this.filterItems.splice(currentIdx, 1, fItem)
    }
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

    // const existingFilterItems = []

    // for (const filterItem of this.filterItems) {

    //   const muSelectedFilter : MuSelectedFilter  = {
    //     id          : filterItem.params.id,
    //     mode        : filterItem.mode,
    //     value       : filterItem.params.value || null,
    //     displayType : filterItem.params.displayType

    //   }
    //   existingFilterItems.push(muSelectedFilter)

    // }

    // console.log('isEqual',isEqual(existingFilterItems, this.filters))


    for (const fItem of this.filterItems) {
      const index = this.filters.findIndex(element => element.id === fItem.params.id)
      let changed : boolean = false
      
      //checking if the previous filter value has changed or not according to the display type
      switch(fItem.params.displayType) {

        case DISPLAY_TYPE.CALENDAR_BOX              :
        case DISPLAY_TYPE.INPUT_BOX                 :
        case DISPLAY_TYPE.SELECTION_BOX             :
        case DISPLAY_TYPE.ROW_INPUT_BOX             :
        case DISPLAY_TYPE.MULTI_CHECK_BOX           :
        case DISPLAY_TYPE.DROPDOWN_MULTI_CHECK_BOX  : 
        case DISPLAY_TYPE.RADIO                     :
        case DISPLAY_TYPE.AUTOCOMPLETE_SELECT       :
        case DISPLAY_TYPE.SLIDER                    : 
          (!fItem.params.value && !this.filters[index].value)
          ? changed = false
          : changed = fItem.params.value !== this.filters[index].value
          break

        case DISPLAY_TYPE.DATE_RANGE    :
          const dateRangeKeys  = fItem.params.rangeKeys || ['startDate', 'endDate'];
          ((!fItem.params.value[dateRangeKeys[0]] && !this.filters[index].value[dateRangeKeys[0]]) &&
          (!fItem.params.value[dateRangeKeys[1]] && !this.filters[index].value[dateRangeKeys[1]]))
          ? changed = false
          : changed = (fItem.params.value[dateRangeKeys[0]] !== this.filters[index].value[dateRangeKeys[0]]) ||
                      (fItem.params.value[dateRangeKeys[1]] !== this.filters[index].value[dateRangeKeys[1]])
          break

        case DISPLAY_TYPE.NUMBER_RANGE  :
          const numRangeKeys  = fItem.params.rangeKeys || ['minAmount', 'maxAmount'];

          ((!fItem.params.value[numRangeKeys[0]] && !this.filters[index].value[numRangeKeys[0]]) &&
          (!fItem.params.value[numRangeKeys[1]] && !this.filters[index].value[numRangeKeys[1]]))
          ? changed = false
          : changed = (fItem.params.value[numRangeKeys[0]] !== this.filters[index].value[numRangeKeys[0]]) ||
                      (fItem.params.value[numRangeKeys[1]] !== this.filters[index].value[numRangeKeys[1]])
          break
      }
    // isEqual(existingFilterItems, this.filters), changed)

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

      case DISPLAY_TYPE.MULTI_CHECK_BOX           :
      case DISPLAY_TYPE.DROPDOWN_MULTI_CHECK_BOX  : 

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