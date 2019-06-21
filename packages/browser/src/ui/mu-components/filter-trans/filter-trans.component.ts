/*------------------------------------------------------------------------------
   About      : Generic component for filtering transactions which can either be
                date, date-range, dropdown list, number, number-range or text 
                search
   
   Created on : Tue Jun 11 2019
   Author     : Divya Sinha
   
   Copyright (c) 2019 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { Component,
         Inject,
         Input,
         Output,
         EventEmitter,
         ViewChild
       }                            from '@angular/core'
import { TranslateService }         from '..'
import { RunContextBrowser }        from '@mubble/browser/rc-browser'
import { MatDatepicker }            from '@angular/material'
import { LOG_LEVEL }                from 'framework'
import { FormControl }              from '@angular/forms'

export enum FILTER_TYPE {
  DATE,
  DATE_RANGE,
  DROP_DOWN,
  NUMBER,
  NUMBER_RANGE,
  TEXT
}

export interface FilterItem {
  id     : string
  label  : string
  type   : FILTER_TYPE
  value ?: string[]
}

export interface SelectedFilter {
  id    : string
  value : string[] | number[] | string | number
}

@Component({
  selector    : 'filter-trans',
  templateUrl : './filter-trans.component.html',
  styleUrls   : ['./filter-trans.component.scss']
})

export class FilterTransComponent {

  @ViewChild(MatDatepicker) startPicker : MatDatepicker<Date>
  @ViewChild(MatDatepicker) endPicker   : MatDatepicker<Date>
  @ViewChild(MatDatepicker) picker      : MatDatepicker<Date>

  @Input()  filterItems     : FilterItem[] = []
  @Output() selectedFilter  = new EventEmitter<SelectedFilter[]>()

  FILTER_TYPE : typeof FILTER_TYPE = FILTER_TYPE

  startDate = new FormControl()
  endDate   = new FormControl()
  minAmount = new FormControl()
  maxAmount = new FormControl()
  
  textSearch  : string = ''
  dropDownOpt : string
  filters     : SelectedFilter[] = []

  constructor(@Inject('RunContext') protected rc  : RunContextBrowser,
              private translate                   : TranslateService) {

    rc.setupLogger(this, 'FilterTrans', LOG_LEVEL.DEBUG)
  }

  ngOnInit() {
    for ( let fItem of this.filterItems) {
      this.filters.push({ id : fItem.id, value : undefined })
    }
  }

  /*=====================================================================
                              HTML
  =====================================================================*/
  applyFilters() {
    if (this.hasError()) {
      return
    }

    this.selectedFilter.emit(this.filters)
  }

  setChangedValue(event : any, fItem : FilterItem) {

    const index = this.filters.findIndex(x => x.id === fItem.id)

    switch (fItem.type) {

      case FILTER_TYPE.DATE :
        this.filters[index].value = event.value.unix()
        break

      case FILTER_TYPE.DROP_DOWN :
        this.dropDownOpt = event.value
        this.filters[index].value = this.dropDownOpt
        break

      case FILTER_TYPE.NUMBER :
        this.filters[index].value = event.target.value + ''
        break

      case FILTER_TYPE.TEXT :
        this.textSearch = event.target.value + ''
        this.filters[index].value = this.textSearch
        break

      case FILTER_TYPE.DATE_RANGE :
        const startDate = this.startDate.value ? this.startDate.value.unix() : undefined,
              endDate   = this.endDate.value   ? this.endDate.value.unix()   : undefined
        this.filters[index].value = [startDate, endDate]
        break

      case FILTER_TYPE.NUMBER_RANGE :
        const minAmount = this.minAmount.value ? this.minAmount.value : undefined,
              maxAmount = this.maxAmount.value ? this.maxAmount.value : undefined
        this.filters[index].value = [ minAmount, maxAmount ]
        break
    }

  }
    
    /*=====================================================================
                              PRIVATE
    =====================================================================*/
  private hasError() : boolean {
    if (this.startDate.value && this.endDate.value && (this.startDate.value > this.endDate.value)) {
      return true
    }

    if (this.endDate.value && !this.startDate.value) {
      return true
    }

    if (this.minAmount.value && this.maxAmount.value && (this.minAmount.value > this.maxAmount.value)) {
      return true
    }

    if (this.maxAmount.value && !this.minAmount.value) {
      return true
    }

    return false
  }

}