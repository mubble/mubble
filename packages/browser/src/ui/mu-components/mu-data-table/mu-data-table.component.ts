import { Component, 
         OnInit, 
         Input, 
         Output, 
         EventEmitter,
         ViewChild
       }                           from '@angular/core'
import { MatCheckboxChange, 
         MatCheckbox 
       }                           from '@angular/material'

export interface TableHeader {
  header        : string
  dataKey       : string
  colType       : COL_TYPE
  enableSort   ?: boolean
  enableFilter ?: boolean
  customStyle  ?: string
  constValue   ?: string
}

export interface TableConfig {
  headers        : TableHeader[]
  data           : Array<Object>
  dispRows      ?: number     
  enableSelect  ?: boolean
  enableRadio   ?: boolean
  selectedItems ?: Object[]
  lazyLoad      ?: boolean
  totalRecords  ?: number
}

export interface MuTableClickEvent {
  rowId    : any
  colId    : string
  rowIndex : number
}

export interface MuTableSelectEvent {
  firstIndex : number
  lastIndex  : number
}

export enum COL_TYPE  {
  ICON        = 'ICON',
  IMAGE       = 'IMAGE',
  BUTTON      = 'BUTTON',
  TEXT        = 'TEXT',
  DATE        = 'DATE',
  PRIMARY_KEY = 'PRIMARY_KEY'
}

@Component({
  selector    : 'mu-data-table',
  templateUrl : './mu-data-table.component.html',
  styleUrls   : ['./mu-data-table.component.scss']
})

export class MuDataTableComponent implements OnInit {

  @Input()  tableConfig   : TableConfig
  @Output() onRowSelect   : EventEmitter<any>    = new EventEmitter()
  @Output() onRowUnselect : EventEmitter<any>    = new EventEmitter()
  @Output() loadMoreData  : EventEmitter<number> = new EventEmitter() 
  @Output() onSelectAll   : EventEmitter<MuTableSelectEvent> = new EventEmitter()
  @Output() onDeSelectAll : EventEmitter<MuTableSelectEvent> = new EventEmitter()
  @Output() onCellClick   : EventEmitter<MuTableClickEvent>  = new EventEmitter() 

  @ViewChild('slctAllBox', {static : false}) slctAllBox : MatCheckbox

  primaryKey       ?: string
  lastIndex         : number   = 0
  totalRecords      : number
  filterFields      : string[] = []
  sortFields        : string[] = []
  headerFields      : string[] = []
  selectedItems     : Object[] = []
  dataToDisplay     : Object[] = []
  enablePagination  : boolean  = false
  loading           : boolean  = false
  COL_TYPE          : typeof COL_TYPE = COL_TYPE  
  selectAllMap      : Object   = {}
  selectedItemIndex : Array<number> = []

  ngOnInit() {

    if (this.tableConfig.dispRows) this.enablePagination = true
    else this.tableConfig.dispRows = 0

    if (this.tableConfig.selectedItems) this.selectedItems = this.tableConfig.selectedItems
  
    for (let header of this.tableConfig.headers) {

      this.headerFields.push(header.dataKey)
      if (header.colType === COL_TYPE.PRIMARY_KEY) this.primaryKey = header.dataKey
      if (!this.tableConfig.lazyLoad) {

        if (header.enableFilter) this.filterFields.push(header.dataKey)
        if (header.enableSort) this.sortFields.push(header.dataKey)
        else this.sortFields.push(null) 
      }
    }

    if (this.tableConfig.data) {
      this.totalRecords = this.tableConfig.totalRecords || this.tableConfig.data.length

      for (const index in this.tableConfig.data) this.tableConfig.data[index]['rowIndex'] = index
    
      if (this.tableConfig.lazyLoad) {
        this.dataToDisplay = Array.from(this.tableConfig.data).splice(0, this.tableConfig.dispRows)
      }
    }

  }

  rowSelect(event) {
    
    const selId : string = this.primaryKey ? event.data[this.primaryKey] : event.data
    this.onRowSelect.emit(selId)
    if (this.tableConfig.selectedItems)
    this.selectedItems = this.tableConfig.selectedItems
  }

  rowUnselect(event) {

    const selId : string = this.primaryKey ? event.data[this.primaryKey] : event.data
    if (this.tableConfig.enableSelect) {
      
      this.selectAllMap[this.lastIndex] = false
      this.slctAllBox.checked = false
    }
    this.onRowUnselect.emit(selId)
    if (this.tableConfig.selectedItems)
    this.selectedItems = this.tableConfig.selectedItems
  }

  cellClick(rowData, headerKey) {

    const obj = {
      rowId    : this.primaryKey ? rowData[this.primaryKey] : rowData,
      colId    : headerKey,
      rowIndex : rowData['rowIndex']
    }
    this.onCellClick.emit(obj)
  }

  loadLazy(event) {

    if (!this.tableConfig.data.length) return
    
    this.lastIndex          = event.first
    if (this.slctAllBox)
    this.slctAllBox.checked = this.selectAllMap[this.lastIndex] || false
    const possibleCount     = event.first + this.tableConfig.dispRows

    if (this.tableConfig.data.length < possibleCount && this.tableConfig.data.length < this.tableConfig.totalRecords) {
      this.loading = true
      this.loadMoreData.emit()
    } else {
      this.dataToDisplay = Array.from(this.tableConfig.data).splice(event.first, this.tableConfig.dispRows)
    }
  }

  updateData(data : Object[]) {
    
    this.tableConfig.data = data
    this.dataToDisplay    = Array.from(this.tableConfig.data).splice(this.lastIndex, this.tableConfig.dispRows)
    for (const index in this.tableConfig.data) this.tableConfig.data[index]['rowIndex'] = index
    this.loading          = false
  }

  markAllCheckbox(status : boolean) {

    this.slctAllBox.checked = status
    this.selectAllMap[this.lastIndex] = status
  }

  selectAllRows(event : MatCheckboxChange) {

    if (this.tableConfig.selectedItems) {

      if (event.checked) {
        this.onSelectAll.emit({firstIndex : this.lastIndex, lastIndex : this.lastIndex + this.tableConfig.dispRows})
      } else {
        this.onDeSelectAll.emit({firstIndex : this.lastIndex, lastIndex : this.lastIndex + this.tableConfig.dispRows})
      }

      this.selectedItems = this.tableConfig.selectedItems
      return
    } 

    
    if (event.checked) {

      this.selectAllMap[this.lastIndex] = true
      this.selectedItemIndex.push(this.lastIndex)
      this.selectedItems = this.selectedItems.concat(Array.from(this.tableConfig.data).splice(this.lastIndex, this.tableConfig.dispRows))
      this.onSelectAll.emit({firstIndex : this.lastIndex, lastIndex : this.lastIndex + this.tableConfig.dispRows})
    } else {

      this.selectAllMap[this.lastIndex] = false
      this.onDeSelectAll.emit({firstIndex : this.lastIndex, lastIndex : this.lastIndex + this.tableConfig.dispRows})
      const startIndex = this.selectedItemIndex.indexOf(this.lastIndex) * this.tableConfig.dispRows
      this.selectedItemIndex.splice(this.selectedItemIndex.indexOf(this.lastIndex), 1)
      this.selectedItems.splice(startIndex, this.tableConfig.dispRows)
      this.selectedItems = Array.from(this.selectedItems)
    }

  }

}
