import { Component, 
         OnInit, 
         Input, 
         Output, 
         EventEmitter,
         ViewChild
       }                           from '@angular/core'
import { MatCheckboxChange, 
         MatRadioChange,
         MatSlideToggleChange,
         MatCheckbox
       }                           from '@angular/material'

export interface TableHeader {
  header        : string
  dataKey       : string
  colType       : COL_TYPE
  customStyle  ?: string
  constValue   ?: any
  enableFilter ?: boolean
  enableSort   ?: boolean
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

export interface MuTableRowSelEvent {
  rowIndex : number
  rowData  : Object
}

export interface MuTableDetailEvent {
  id      : string
  rowData : Object
}

export interface MuTableSelectEvent {
  firstIndex : number
  lastIndex  : number
}

export interface MuTableToggleEvent {
  rowData  : Object
  rowIndex : number
}

export interface MuTableClickEvent {
  rowIndex  : number
  rowData   : Object
  headerKey : string
}

export interface MuTableMoreDetail {
  id    : string
  value : string
}

export enum COL_TYPE  {
  ICON         = 'ICON',
  IMAGE        = 'IMAGE',
  BUTTON       = 'BUTTON',
  TEXT         = 'TEXT',
  DATE         = 'DATE',
  TOGGLE       = 'TOGGLE',
  MORE_DETAILS = 'MORE_DETAILS'
}

@Component({
  selector    : 'mu-data-table',
  templateUrl : './mu-data-table.component.html',
  styleUrls   : ['./mu-data-table.component.scss']
})

export class MuDataTableComponent implements OnInit {

  @ViewChild('slctAllBox', {static : false}) slctAllBox : MatCheckbox

  @Input()  tableConfig         : TableConfig
  @Output() onRowSelect         : EventEmitter<any>    = new EventEmitter()
  @Output() onRowUnselect       : EventEmitter<any>    = new EventEmitter()
  @Output() loadMoreData        : EventEmitter<number> = new EventEmitter() 
  @Output() onSelectAll         : EventEmitter<MuTableSelectEvent>  = new EventEmitter()
  @Output() onDeSelectAll       : EventEmitter<MuTableSelectEvent>  = new EventEmitter()
  @Output() onDetailClick       : EventEmitter<MuTableDetailEvent>  = new EventEmitter()
  @Output() onToggleActivate    : EventEmitter<MuTableToggleEvent>  = new EventEmitter()
  @Output() onToggleDeActivate  : EventEmitter<MuTableToggleEvent>  = new EventEmitter()
  @Output() onButtonClick       : EventEmitter<MuTableClickEvent>   = new EventEmitter()
  @Output() onCellClick         : EventEmitter<MuTableRowSelEvent>  = new EventEmitter() 

  totalRecords      : number
  dispRows          : number 

  pageIndex         : number   = 0
  currentIndex      : number   = 0
  currActivePage    : number   = 1

  prevIndex         : number   = 0
  prevActivePage    : number   = 1

  selectedIndexes   : Object   = {}
  selAllMap         : Object   = {}
  dataMap           : Object   = {}
  headerFields      : string[] = []
  dataToDisplay     : Object[] = []
  pageNumbers       : number[] = []
  moreDetails       : MuTableMoreDetail[] = []
  COL_TYPE          : typeof COL_TYPE     = COL_TYPE  

  ngOnInit() {
      
    if (this.tableConfig) {

      for (let header of this.tableConfig.headers) this.headerFields.push(header.dataKey)
      for (const index in this.tableConfig.data)   this.tableConfig.data[index]['rowIndex'] = index

      this.totalRecords  = this.tableConfig.totalRecords || this.tableConfig.data.length
      this.dispRows      = this.tableConfig.dispRows     || this.tableConfig.data.length
      
      this.mapData(this.tableConfig.data, 0)

      //Setting up the page numbers for pagination
      let totalPages = this.totalRecords / this.dispRows
      if (this.totalRecords % this.dispRows) totalPages++
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) this.pageNumbers.push(pageNumber)  

    }
  }

  rowSelect(event : MatCheckboxChange, rowData : any) {
    
    const selectedIndex = rowData['rowIndex']

    if (event.checked) {
      this.selectedIndexes[selectedIndex] = true
      const selEvent : MuTableRowSelEvent = {
        rowData  : rowData,
        rowIndex : selectedIndex
      }
      this.onRowSelect.emit(selEvent)
    } else {

      const selEvent : MuTableRowSelEvent = {
        rowData  : rowData,
        rowIndex : selectedIndex
      }
      
      this.slctAllBox.checked = false
      this.selAllMap[this.currActivePage]  = false
      this.selectedIndexes[selectedIndex] = false
      this.onRowUnselect.emit(selEvent)
    }    
  }

  selectAll(event : MatCheckboxChange) {
        
    this.slctAllBox.checked = event.checked
    this.selAllMap[this.currActivePage] = event.checked 
    
    for (let index = this.currentIndex; index < (this.currentIndex + this.dispRows); index++)
      this.selectedIndexes[index] = event.checked
    
    if (event.checked) this.onSelectAll.emit()
    else this.onDeSelectAll.emit()
  }

  radioSelect(event : MatRadioChange, rowData : Object) {

    this.selectedIndexes = []
    const selectedIndex  = rowData['rowIndex']
    this.selectedIndexes[selectedIndex] = true
    const selEvent : MuTableRowSelEvent = {
      rowData  : rowData,
      rowIndex : selectedIndex
    }
    this.onRowSelect.emit(selEvent)
  }

  moreDetailsClick(detKey : string, rowData : Object) {

    const moreSelEvent : MuTableDetailEvent = {
      id      : detKey,
      rowData : rowData
    }
    this.onDetailClick.emit(moreSelEvent)
  }

  toggleRow(event : MatSlideToggleChange, rowData : Object) {

    const toggleEvent : MuTableToggleEvent = {
      rowData  : rowData,
      rowIndex : rowData['rowIndex']
    }
    
    if (event.checked) this.onToggleActivate.emit(toggleEvent)
    else this.onToggleDeActivate.emit(toggleEvent)
  }

  buttonClick(rowData : Object, headerKey : string) {

    const buttonEvent : MuTableClickEvent = {
      headerKey : headerKey,
      rowData   : rowData,
      rowIndex  : rowData['rowIndex']
    }
    this.onButtonClick.emit(buttonEvent)
  }

  mapData(data : Array<Object>, startIndex : number) {
    
    const dataSetCount = Math.ceil(data.length/this.dispRows)

    for (let i = 0; i < dataSetCount; i++) {
     
      const mapData = data.splice(0, this.dispRows),
            mapKey  = startIndex + (i* this.dispRows)

      if (mapData.length === this.dispRows 
          || !this.tableConfig.lazyLoad 
          || (this.tableConfig.lazyLoad && this.tableConfig.totalRecords < (mapKey + this.dispRows))) 
        this.dataMap[mapKey] = mapData 
    } 
    
    this.dataToDisplay = this.dataMap[startIndex] 
  }

  onPageClick(pageIndex : number) {
    
    this.prevActivePage = this.currActivePage
    this.prevIndex      = this.currentIndex
    this.currActivePage = pageIndex   
    if (this.slctAllBox)
    this.slctAllBox.checked = this.selAllMap[this.currActivePage] || false
  
    this.currentIndex  = (pageIndex - 1) * this.dispRows

    //Handling page numbers change
    this.changePageNumbers(pageIndex)
        
    //Handling data change
    if (this.dataMap[this.currentIndex]) {
      this.dataToDisplay = this.dataMap[this.currentIndex]
    } else {
      this.loadMoreData.emit(this.currentIndex + 1)
    } 
  }  

  private changePageNumbers(pageIndex : number) {
    if (this.pageNumbers.length > 5) {
      this.pageIndex     = pageIndex - 3
      if (this.pageIndex < 0) this.pageIndex = 0
      if (this.pageIndex > (this.pageNumbers.length - 5)) this.pageIndex = this.pageNumbers.length - 5
    }
  }
  
  updateData(data : Object[]) {

    for (let i = 0; i < data.length; i++) data[i]['rowIndex'] = (i + this.currentIndex).toString()    
    this.mapData(data, this.currentIndex) 
  }

  loadingFailed() {

    this.currentIndex   = this.prevIndex
    this.currActivePage = this.prevActivePage
    this.changePageNumbers(this.currActivePage)
  }

  onDivClick(rowData : Object, headerKey : string) {

    const buttonEvent : MuTableClickEvent = {
      headerKey : headerKey,
      rowData   : rowData,
      rowIndex  : rowData['rowIndex']
    }
    this.onCellClick.emit(buttonEvent)
  }

}
