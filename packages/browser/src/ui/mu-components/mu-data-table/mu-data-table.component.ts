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
import { FormControl, 
         FormGroup
       }                           from '@angular/forms'

export interface TableHeader {
  header        : string
  dataKey       : string
  colType       : COL_TYPE
  customStyle  ?: string
  constValue   ?: any
  enableSort   ?: boolean
  widthPerc    ?: number
  isEditable   ?: boolean
}

export interface TableConfig {
  headers        : TableHeader[]
  data           : Array<Object>
  dispRows      ?: number     
  enableSelect  ?: boolean
  enableRadio   ?: boolean
  enableFilter  ?: boolean
  selectedItems ?: Object[]
  lazyLoad      ?: boolean
  totalRecords  ?: number
}

export interface MuTableRowSelEvent {
  rowIndex   : number
  rowData    : Object
  isSelected : boolean
}

export interface MuTableDetailEvent {
  id      : string
  rowData : Object
}

export interface MuTableSelAllEvent {
  selectedRows : Object[]
  isSelected   : boolean
}

export interface MuTableToggleEvent {
  rowData  : Object
  rowIndex : number
  isActive : boolean
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

export interface MuTableEditEvent {
  rowIndex     : number
  rowData      : Object
  editedValues : Object
}

export enum COL_TYPE  {
  ICON         = 'ICON',
  IMAGE        = 'IMAGE',
  BUTTON       = 'BUTTON',
  TEXT         = 'TEXT',
  DATE         = 'DATE',
  EDIT         = 'EDIT',
  TOGGLE       = 'TOGGLE',
  HYPER_LINK   = 'HYPER_LINK',
  MORE_DETAILS = 'MORE_DETAILS'
}

@Component({
  selector    : 'mu-data-table',
  templateUrl : './mu-data-table.component.html',
  styleUrls   : ['./mu-data-table.component.scss']
})

export class MuDataTableComponent implements OnInit {

  @ViewChild('slctAllBox', {static : false}) slctAllBox : MatCheckbox

  @Input()  tableConfig        : TableConfig
  @Output() loadMoreData       : EventEmitter<number> = new EventEmitter() 
  @Output() onRowSelect        : EventEmitter<MuTableRowSelEvent>  = new EventEmitter()
  @Output() onSelectAll        : EventEmitter<MuTableSelAllEvent>  = new EventEmitter()
  @Output() onDetailClick      : EventEmitter<MuTableDetailEvent>  = new EventEmitter()
  @Output() onRowToggle        : EventEmitter<MuTableToggleEvent>  = new EventEmitter()
  @Output() onCellClick        : EventEmitter<MuTableClickEvent>   = new EventEmitter()
  @Output() onRowEdit          : EventEmitter<MuTableEditEvent>    = new EventEmitter()

  totalRecords      : number
  dispRows          : number 
  pageIndex         : number   
  currPageIndex     : number  
  prevPageIndex     : number   

  selectedIndexes   : Object   = {}
  selAllMap         : Object   = {}
  dataMap           : Object   = {}
  headerFields      : string[] = []
  filterFields      : string[] = []
  dataToDisplay     : Object[] = []
  pageNumbers       : number[] = []
  toggleActIndexes  : Object   = {}

  COL_TYPE          : typeof COL_TYPE = COL_TYPE  
  editForm          : FormGroup       = new FormGroup({})

  ngOnInit() {
      
    if (this.tableConfig) {

      for (let header of this.tableConfig.headers) {
        if (header.isEditable)   this.editForm.addControl(header.dataKey, new FormControl())
        this.headerFields.push(header.dataKey)

        if (this.tableConfig.enableFilter && 
            (header.colType === COL_TYPE.HYPER_LINK ||
            header.colType === COL_TYPE.TEXT)) {
          this.filterFields.push(header.dataKey)
        }

      }
      
      if (this.tableConfig.selectedItems) 
        for (const item of this.tableConfig.selectedItems) this.toggleActIndexes[item.toString()] = true
    
      this.totalRecords  = this.tableConfig.totalRecords || this.tableConfig.data.length
      this.dispRows      = this.tableConfig.dispRows     || this.tableConfig.data.length
      
      this.createDataMap(this.tableConfig.data, 0)
      this.createPageNumbers()
    }
  }

  /**
   * Creates the page numbers needed for pagination
   * Called during initialization of table and updation of data inside table
   */
  private createPageNumbers() {
    
    this.pageNumbers    = []
    this.currPageIndex  = this.prevPageIndex = this.pageIndex = 0
    let totalPages      = this.totalRecords / this.dispRows
    
    if (this.totalRecords % this.dispRows) totalPages++

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) 
      this.pageNumbers.push(pageNumber)  
  }

  private updatePageNumbers(pageIndex : number) {
    
    this.pageIndex     = pageIndex - 2
    if (this.pageIndex <= 0) this.pageIndex = 0
    if (this.pageIndex > (this.pageNumbers.length - 4)) this.pageIndex = this.pageNumbers.length - 5
  }

  rowSelect(event : MatCheckboxChange, rowData : any) {
    
    const selectedIndex = rowData['rowIndex']

    if (event.checked) {

      this.selectedIndexes[selectedIndex] = true
    } else {
      
      this.slctAllBox.checked = false
      this.selAllMap[this.currPageIndex] = false
      this.selectedIndexes[selectedIndex] = false
    }   
    
    const selEvent : MuTableRowSelEvent = {
      rowData    : rowData,
      rowIndex   : selectedIndex,
      isSelected : event.checked
    }

    this.onRowSelect.emit(selEvent) 
  }

  selectAll(event : MatCheckboxChange) {
        
    this.slctAllBox.checked = event.checked
    this.selAllMap[this.currPageIndex] = event.checked 
        
    for (let index = 0; index < (this.currPageIndex + this.dispRows); index++) 
      this.selectedIndexes[index + (this.currPageIndex * this.dispRows)] = event.checked
    
    const selAllEvent : MuTableSelAllEvent = {
      selectedRows : this.dataMap[this.currPageIndex],
      isSelected   : event.checked
    }
    this.onSelectAll.emit(selAllEvent)
  }

  radioSelect(event : MatRadioChange, rowData : Object) {

    this.selectedIndexes = []
    const selectedIndex  = rowData['rowIndex']
    this.selectedIndexes[selectedIndex] = true
    const selEvent : MuTableRowSelEvent = {
      rowData    : rowData,
      rowIndex   : selectedIndex,
      isSelected : true
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
      rowIndex : rowData['rowIndex'],
      isActive : event.checked
    }
    
    this.onRowToggle.emit(toggleEvent)
  }

  /**
   * mapData creates a map of row objects that needs to be displayed in the table
   * with index as the key and array of objects as its value
   * @param data the data that needs to be mapped
   * @param startIndex - index from which data needs to be mapped
   */

  createDataMap(data : Array<Object>, startIndex : number) {
                
    const dataSetCount = Math.ceil(data.length/this.dispRows),
          currData     = Array.from(data)
    
    for (const index in currData) currData[index]['rowIndex'] = index 

    for (let i = 0; i < dataSetCount; i++) {
     
      const mapData = currData.splice(0, this.dispRows),
            mapKey  = startIndex + i
                  
      if (mapData.length === this.dispRows 
          || !this.tableConfig.lazyLoad 
          || (this.tableConfig.lazyLoad && this.totalRecords < (mapKey + this.dispRows))) 
        this.dataMap[mapKey] = mapData 
    }
        
    this.dataToDisplay = this.dataMap[startIndex] 
  }

  /**
   * Called when user clicked on a page with its index as parameter.
   * Displays the data of that index from the data map, if the data does not exists,
   * a callback is given to the parent to load more data.
   * @param pageIndex 
   */
  onPageClick(pageIndex : number) {
    
    this.prevPageIndex = this.currPageIndex
    this.currPageIndex = pageIndex 

    if (this.slctAllBox)
    this.slctAllBox.checked = this.selAllMap[this.currPageIndex] || false
  
    //Handling page numbers change
    if (this.pageNumbers.length > 5) this.updatePageNumbers(pageIndex)
        
    //Handling data change
    if (this.dataMap[this.currPageIndex]) {
      this.dataToDisplay = this.dataMap[pageIndex]
    } else {      
      this.loadMoreData.emit(pageIndex * this.dispRows)
    } 
  }  
  
  updateData(data : Object[], currentIndex ?: number) {

    if (currentIndex === 0) {
      
      this.currPageIndex = currentIndex
      this.dataMap       = {}
      this.createPageNumbers()
    }
    
    for (let i = 0; i < data.length; i++) 
      data[i]['rowIndex'] = (i + (this.currPageIndex * this.dispRows)).toString()    
    this.createDataMap(data, this.currPageIndex) 
  }

  loadingFailed() {

    this.currPageIndex = this.prevPageIndex
    this.updatePageNumbers(this.currPageIndex)
  }

  cellClick(rowData : Object, headerKey : string) {
    
    const buttonEvent : MuTableClickEvent = {
      headerKey : headerKey,
      rowData   : rowData,
      rowIndex  : rowData['rowIndex']
    }
    this.onCellClick.emit(buttonEvent)
  }

  search(event : any) {

    const inputText      = event.target.value
    
    if (!inputText) {
      this.dataToDisplay = this.dataMap[this.currPageIndex]
      return
    }
    
    this.dataToDisplay = this.dataMap[this.currPageIndex].filter(dataRow => {
      if (this.filterFields.filter(header => dataRow[header] && dataRow[header].toString().toLowerCase()
                                             .includes(inputText.toString().toLowerCase()))
                                             .length) 
        return true
    })
  }

  /**
   * Inserts a data row at the beginning of the table by clearing the datamap 
   * @param obj - data object that needs to be inserted
   */
  insertRow(obj : Object) {
    
    let firstPageData = this.dataMap[0]
    this.dataMap = {}
    firstPageData.unshift(obj)
    firstPageData.pop()    
    this.createDataMap(firstPageData, 0)
    this.totalRecords++
    this.createPageNumbers()
  }

  /**
   * Deletes a row of given row index assuming that the index which is to deleted is currently 
   * being displayed. Checks whether next page data exists in the map and reorders the sequence by 
   * shifting the data, if not a callback is sent to parent to load data for that index. 
   * @param rowIndex - index of the data which needs to be deleted
   */
  deleteRow(rowIndex : number) {
    
    if (this.dataMap[this.currPageIndex + 1]) {

      this.dataMap[this.currPageIndex].splice(rowIndex%this.dispRows, 1)
      this.dataMap[this.currPageIndex].push(this.dataMap[this.currPageIndex + 1][0])
    } else {

      this.loadMoreData.emit(this.currPageIndex * this.dispRows )
    }   

    this.selectedIndexes = {}
    const keys = Object.keys(this.dataMap)
    for (const key of keys) if (Number(key) > this.currPageIndex) delete this.dataMap[key]
  }

  editRow(rowData : Object, isEdit : boolean) {
    
    this.selectedIndexes = {}
    if (isEdit) {

      this.selectedIndexes[rowData['rowIndex']] = true
    } else {

      const editEvent : MuTableEditEvent = {
        editedValues : this.editForm.value,
        rowData      : rowData,
        rowIndex     : rowData['rowIndex']
      }
      this.onRowEdit.emit(editEvent)
    }
    this.editForm.reset()
  }

  updateRow(rowIndex : number, data : Object) {

    this.dataMap[this.currPageIndex][rowIndex % this.dispRows] = data
  }
}
