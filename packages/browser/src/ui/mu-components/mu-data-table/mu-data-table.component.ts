import { Component, 
         OnInit, 
         Input, 
         Output, 
         EventEmitter,
         ViewChild,
         Inject,
         ElementRef,
         ChangeDetectorRef,
         SimpleChanges
       }                            from '@angular/core'
import { MatCheckboxChange, 
         MatRadioChange,
         MatSlideToggleChange,
         MatCheckbox
       }                            from '@angular/material'
import { FormControl, 
         FormGroup
       }                            from '@angular/forms'

import { TableHeader, 
         FilterItem, 
         DISPLAY_MODE
       }                            from '@mubble/core/interfaces/app-server-interfaces'
import { RunContextBrowser }        from '@mubble/browser/rc-browser'
import { LOG_LEVEL,              
         COL_TYPE 
       }                            from '@mubble/core'
import { SelectedFilter }           from '../filter'

export interface TableConfig {
  headers            : TableHeader[]
  data               : Array<Object>
  dispRows          ?: number     
  enableSelect      ?: boolean
  enableRadio       ?: boolean
  enableFilter      ?: boolean
  selectedIndexes   ?: number[]
  lazyLoad          ?: boolean
  totalRecords      ?: number
  horizFilterParams ?: FilterItem[],
  vertFilterParams  ?: FilterItem[],
  // eventPropagate    ?: boolean
}

export interface MuTableRowSelEvent {
  rowIndex      : number
  rowData       : Object
  isSelected    : boolean
  browserEvent  : any
}

export interface MuTableDetailEvent {
  id      : string
  rowData : Object
}

export interface MuTableSelAllEvent {
  selectedRows : Object[]
  isSelected   : boolean
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

@Component({
  selector    : 'mu-data-table',
  templateUrl : './mu-data-table.component.html',
  styleUrls   : ['./mu-data-table.component.scss']
})

export class MuDataTableComponent implements OnInit {

  @ViewChild('slctAllBox',  {static : false}) slctAllBox : MatCheckbox
  @ViewChild('filterCont',  {static : false}) filterCont : ElementRef
  @ViewChild('muTableCont', {static : false}) muTableCont : ElementRef



  @Input()  tableConfig        : TableConfig
  @Output() loadMoreData       : EventEmitter<number> = new EventEmitter() 
  @Output() onRowSelect        : EventEmitter<MuTableRowSelEvent>  = new EventEmitter()
  @Output() onSelectAll        : EventEmitter<MuTableSelAllEvent>  = new EventEmitter()
  @Output() onDetailClick      : EventEmitter<MuTableDetailEvent>  = new EventEmitter()
  @Output() onCellClick        : EventEmitter<MuTableClickEvent>   = new EventEmitter()
  @Output() onRowEdit          : EventEmitter<MuTableEditEvent>    = new EventEmitter()

  @Output() selectedFilter     : EventEmitter<SelectedFilter[]> = new EventEmitter<SelectedFilter[]>()

  pageIndex         : number   
  currPageIndex     : number  
  prevPageIndex     : number   
  isTogglePresent   : boolean

  selectedIndexes   : Object   = {} 
  selAllMap         : Object   = {} 
  headerFields      : string[] = []
  dataToDisplay     : Object[] = []
  pageNumbers       : number[] = []

  private filterFields : string[] = []
  private dataMap      : Object   = {}

  editForm          : FormGroup = new FormGroup({})
  COL_TYPE          : typeof COL_TYPE     = COL_TYPE  
  DISPLAY_MODE      : typeof DISPLAY_MODE = DISPLAY_MODE

  constructor(@Inject('RunContext') protected rc      : RunContextBrowser,
                                    private changeDet : ChangeDetectorRef) {

    if (rc.getLogLevel() === LOG_LEVEL.DEBUG) window['datatable'] = this
  }

  ngOnChanges(changes : SimpleChanges) {
    this.tableConfig  = changes['tableConfig'].currentValue
    this.setUpTable()
  }


  ngOnInit() {
    this.setUpTable()
  }


  ngAfterViewInit() {

    const top = this.filterCont.nativeElement.offsetTop
    this.filterCont.nativeElement.style.maxHeight = `calc(100% - ${top}px)`
  }

  /*=====================================================================
                              PRIVATE
  =====================================================================*/

  private setUpTable() {

    if (this.tableConfig) {

      for (let header of this.tableConfig.headers) {

        if (header.colType === COL_TYPE.TOGGLE) this.isTogglePresent = true 
        
        if (header.isEditable) this.editForm.addControl(header.dataKey, new FormControl())
        
        this.headerFields.push(header.dataKey)

        if (this.tableConfig.enableFilter && 
            (header.colType === COL_TYPE.HYPER_LINK ||
            header.colType === COL_TYPE.TEXT)) {
          this.filterFields.push(header.dataKey)
        }
      }

      if (this.tableConfig.selectedIndexes)
      this.tableConfig.selectedIndexes.map(index => this.selectedIndexes[index]= true)          
      this.tableConfig.totalRecords  = this.tableConfig.totalRecords || this.tableConfig.data.length
      this.tableConfig.dispRows      = this.tableConfig.dispRows     || this.tableConfig.data.length
      
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
    let totalPages      = this.tableConfig.totalRecords / this.tableConfig.dispRows
    
    if (this.tableConfig.totalRecords % this.tableConfig.dispRows) totalPages++

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) 
      this.pageNumbers.push(pageNumber)  
  }


  /**
   * changes the pagenumbers according to the current selected page number
   * @param pageIndex 
   */
  private updatePageNumbers(pageIndex : number) {
    
    this.pageIndex     = pageIndex - 2
    if (this.pageIndex <= 0) this.pageIndex = 0
    if (this.pageIndex >= (this.pageNumbers.length - 4)) this.pageIndex = this.pageNumbers.length - 5
  }


  /**
   * sends a callback to parent with main event and row data on click of radio button, checkbox or 
   * toggle button so that parent can stop the default action
   * @param event 
   * @param rowData 
   */
  rowClick(event : any, rowData : any) {

    const selEvent : MuTableRowSelEvent = {
      rowData       : rowData,
      rowIndex      : rowData['rowIndex'],
      isSelected    : this.selectedIndexes[rowData['rowIndex']] ? false : true,
      browserEvent  : event
    }

    this.onRowSelect.emit(selEvent) 
  }


  /**
   * Changes the select all indexes map according to user preference on click of checkbox
   * @param event 
   * @param rowData 
   */
  rowSelect(event : MatCheckboxChange, rowData : any) {
    
    if (event.checked) {

      this.selectedIndexes[rowData['rowIndex']] = true
    } else {
      
      this.slctAllBox.checked = false
      this.selAllMap[this.currPageIndex] = false
      this.selectedIndexes[rowData['rowIndex']] = false
    }   
  }


  /**
   * Selects all the rows in the page that is being displayed and a callback is 
   * sent to the parent with the rows that are selected.
   */
  selectAll(event : MatCheckboxChange) {
        
    this.slctAllBox.checked = event.checked
    this.selAllMap[this.currPageIndex] = event.checked 
        
    for (let index = 0; index < (this.currPageIndex + this.tableConfig.dispRows); index++) 
      this.selectedIndexes[index + (this.currPageIndex * this.tableConfig.dispRows)] = event.checked
    
    const selAllEvent : MuTableSelAllEvent = {
      selectedRows : this.dataMap[this.currPageIndex],
      isSelected   : event.checked
    }
    this.onSelectAll.emit(selAllEvent)
  }


  /**
   * Changes the select all indexes map according to user preference on click of radio button
   * @param event 
   * @param rowData 
   */
  radioSelect(event : MatRadioChange, rowData : Object) {

    this.selectedIndexes = { }
    const selectedIndex  = rowData['rowIndex']
    this.selectedIndexes[selectedIndex] = true
  }


  /**
   * Sends call back to the parent on click of an option inside moredetails along with
   * the ID of the option and rowData
   * @param detKey 
   * @param rowData 
   */
  moreDetailsClick(detKey : string, rowData : Object) {

    const moreSelEvent : MuTableDetailEvent = {
      id      : detKey,
      rowData : rowData
    }
    this.onDetailClick.emit(moreSelEvent)
  }


  /**
   * Changes the select all indexes map according to user preference on click of toggle button
   * @param event 
   * @param rowData 
   */
  toggleRow(event : MatSlideToggleChange, rowData : Object) {
  
    this.selectedIndexes[rowData['rowIndex']] = event.checked    
  }


  /**
   * mapData creates a map of row objects that needs to be displayed in the table
   * with index as the key and array of objects as its value
   * @param data the data that needs to be mapped
   * @param startPageIndex - index from which data needs to be mapped
   */
  createDataMap(data : Array<Object>, startPageIndex : number) {
                    
    const dataSetCount = Math.ceil(data.length/this.tableConfig.dispRows),
          currData     = JSON.parse(JSON.stringify(data))
    
    for (let index = 0; index < currData.length; index++) 
      currData[index]['rowIndex'] = index + (startPageIndex * this.tableConfig.dispRows)

    for (let i = 0; i < dataSetCount; i++) {
     
      const mapData = currData.splice(0, this.tableConfig.dispRows),
            mapKey  = startPageIndex + i
                  
      if (mapData.length === this.tableConfig.dispRows 
          || !this.tableConfig.lazyLoad 
          || (this.tableConfig.lazyLoad && this.tableConfig.totalRecords <= ((mapKey * this.tableConfig.dispRows) + mapData.length))) 
        this.dataMap[mapKey] = mapData 
    }
    
    this.dataToDisplay = this.dataMap[startPageIndex] || []
    this.changeDet.detectChanges()
  }


  /**
   * Called when user clicked on a page with its index as parameter.
   * Displays the data of that index from the data map, if the data does not exists,
   * a callback is given to the parent to load more data.
   * @param pageIndex 
   */
  onPageClick(pageIndex : number) {

    if (pageIndex >= this.pageNumbers.length) {
      pageIndex = this.pageNumbers.length - 1
    } else if (pageIndex < 0) {
      pageIndex = 0
    }
    
    this.prevPageIndex = this.currPageIndex
    this.currPageIndex = pageIndex 

    if (this.slctAllBox) {
      this.slctAllBox.checked = this.selAllMap[this.currPageIndex] || false
    }
  
    //Handling page numbers change
    if (this.pageNumbers.length > 5) this.updatePageNumbers(pageIndex)
        
    //Handling data change
    if (this.dataMap[this.currPageIndex]) {
      this.dataToDisplay = this.dataMap[pageIndex]
    } else {      
      this.loadMoreData.emit(pageIndex * this.tableConfig.dispRows)
    } 
  }  
  

  /**
   * Updates the table data with new data, an optional parameter currentIndex should
   * be sent as '0' inorder to clear the refresh the table.
   * @param data 
   * @param currentIndex 
   */
  updateData(data : Object[], currentIndex ?: number) {

    if (currentIndex === 0) {
      
      this.currPageIndex = currentIndex
      this.dataMap       = {}
      this.createPageNumbers()
    }

    if (!this.tableConfig.lazyLoad) this.tableConfig.totalRecords = data.length
    this.createDataMap(data, this.currPageIndex)     
  }


  /**
   * Method invoked by the parent in case of api loading failure which brings back
   * the table to previous state
   */
  loadingFailed() {

    this.currPageIndex = this.prevPageIndex
    this.updatePageNumbers(this.currPageIndex)
  }


  /**
   * Sends callback to the parent when the user clicks on hyperlink
   * @param rowData 
   * @param headerKey 
   */
  cellClick(rowData : Object, headerKey : string) {
    
    const buttonEvent : MuTableClickEvent = {
      headerKey : headerKey,
      rowData   : rowData,
      rowIndex  : rowData['rowIndex']
    } 
    this.onCellClick.emit(buttonEvent)
  }


  /**
   * performs search operation on the data available in the table only if table
   * is not lazy loaded. In case of lazy loading a callback is given to parent.
   * @param event 
   */
  search(inputText ?: string) {
    
    this.dataMap     = {}
    let filteredData = []

    if (!inputText) {

      filteredData = this.tableConfig.data
    } else {

      filteredData = this.tableConfig.data.filter(dataRow => {
        if (this.filterFields.filter(header => dataRow[header] && dataRow[header].toString().toLowerCase()
                                               .includes(inputText.toString().toLowerCase()))
                                               .length) 
          return true
      })
    }

    this.tableConfig.totalRecords = filteredData.length
    this.createDataMap(filteredData, 0)
    this.createPageNumbers()
  }


  /**
   * Inserts a data row at the beginning of the table by clearing the datamap 
   * @param obj - data object that needs to be inserted
   */
  insertRow(obj : Object) {
    
    let newData = []
    if (!this.tableConfig.lazyLoad) {

      this.tableConfig.data.unshift(obj)
      newData = this.tableConfig.data

      //Need to verify
      let newIndexes = {}
      for (let index of Object.keys(this.selectedIndexes)) newIndexes[Number(index) + 1] = true
      this.selectedIndexes = {}
      this.selectedIndexes = newIndexes
    } else {

      let firstPageData = this.dataMap[0]      
      firstPageData.unshift(obj)
      firstPageData.pop()    
      newData = firstPageData
    }
    
    this.dataMap = {}
    this.tableConfig.totalRecords++
    this.createDataMap(newData, 0)
    this.createPageNumbers()
  }


  /**
   * Deletes a row of given row index assuming that the index which is to deleted is currently 
   * being displayed. Checks whether next page data exists in the map and reorders the sequence by 
   * shifting the data, if not a callback is sent to parent to load data for that index. 
   * @param rowIndex - index of the data which needs to be deleted
   */
  deleteRow(rowIndex : number) {
    
    if (!this.tableConfig.lazyLoad) {
      this.tableConfig.data.splice(rowIndex, 1)
      this.dataMap = {}
      this.createDataMap(this.tableConfig.data, 0)
      this.tableConfig.totalRecords--
      this.createPageNumbers()

      //Need to verify
      let newIndexes = {}
      for (let index of Object.keys(this.selectedIndexes)) newIndexes[Number(index) - 1] = true
      this.selectedIndexes = {}
      this.selectedIndexes = newIndexes
      return
    }

    if (this.dataMap[this.currPageIndex + 1]) {

      this.dataMap[this.currPageIndex].splice(rowIndex%this.tableConfig.dispRows, 1)
      this.dataMap[this.currPageIndex].push(this.dataMap[this.currPageIndex + 1][0])
    } else {

      this.loadMoreData.emit(this.currPageIndex * this.tableConfig.dispRows)
    }   

    this.selectedIndexes = {}
    const keys = Object.keys(this.dataMap)
    for (const key of keys) if (Number(key) > this.currPageIndex) delete this.dataMap[key]
  }


  /**
   * Enables editing the data for editable coloumns when the user clicks on edit button.
   * Sends callback to the parent with new values when user saves the data.
   */
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


  /**
   * updates the data of given rowIndex, usually called after editing the data.
   * @param rowIndex 
   * @param data 
   */
  updateRow(rowIndex : number, data : Object) {

    this.dataMap[this.currPageIndex][rowIndex % this.tableConfig.dispRows] = data
  }


  /**
   * Call back from filter component on applying filters that was directly passed
   * back to the parent
   * @param event 
   */
  applyFilter(event : SelectedFilter[]) {
    /*
    If data table has all the data, filters are applied by the table itself 
    instead of making an api call
    */
    if (!this.tableConfig.lazyLoad) {
      if (event && event[0]) this.search(event[0].value.toString())
      else this.search()
      return
    }
    this.changeDet.detectChanges()
    this.selectedFilter.emit(event)
    
  }

  /**
   * Method invoked by parent to unselect the rows
   * @param rowIndexes
   */
  unselectIndexes(rowIndexes : number[]) {

    for (const index of rowIndexes) this.selectedIndexes[index]  = false
    if (this.slctAllBox) this.slctAllBox.checked = false
    this.selAllMap[this.currPageIndex] = false
  }
}
