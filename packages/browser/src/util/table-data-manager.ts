/*------------------------------------------------------------------------------
   About      : Class to manage the data of the mu-data table durig lazy load
   
   Created on : Thu Nov 07 2019
   Author     : Pulkit Chaturvedi
   
   Copyright (c) 2019 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { Mubble }                   from '@mubble/core'
import { MuDataTableComponent, 
         TableConfig 
       }                            from '../ui'

export interface TableDataMgrListener {
  loadMore(lastIndex : number) : void
}

export interface TableDataManagerParams {
  data      : Array<Object>
  lastIndex : number
} 

export class TableDataManager {

  private dataParams      : TableDataManagerParams = { } as TableDataManagerParams
  private dispRows        : number
  private totalDataCount  : number
  private currentKeyIndex : number
  private lastKeyIndex    : number
  private pendingRequest  : boolean
  private dataObject      : Mubble.uObject<any> = { }

  constructor(private parentInst  : TableDataMgrListener,
              public  tableInst   : MuDataTableComponent) {
  }

  /**
  * Method to get the table config and get the dispRows and totalDataCount and data
  * @param tableConfig : To set the table config in the data table
  */
  init(tableConfig : TableConfig, lastIndex : number) {

    this.dataParams.data = []
    this.dispRows        = tableConfig.dispRows || 0
    this.totalDataCount  = tableConfig.totalRecords || 0

    const params : TableDataManagerParams = {
      lastIndex     : lastIndex,
      data          : tableConfig.data
    }

    const data : Array<Object> = tableConfig.data.slice(0, this.dispRows)
    tableConfig.data = data

    this.tableInst.setTableConfig(tableConfig)
    this.updateData(params)
  }

  /**
  * parent will populate the data, moreAvailable and lastIndex in this method
  * @param params : Updating the params by the parent so  that the data can be populated into the manager
  */
  updateData(params : TableDataManagerParams) {

    this.dataParams.data.push(...params.data)
    this.dataParams.lastIndex = params.lastIndex
    const keys                = Object.keys(this.dataObject)

    if (!keys.length) {
      this.mapData(0)
    return
    }

    this.mapData(this.currentKeyIndex)
  }

  /**
  * mapping the data into the data object
  * @param index : Index to set as key in the data object
  */
  private mapData(index : number) {
    while (index < this.dataParams.lastIndex) {
      if (this.dataObject[index] && this.dataObject[index].length === this.dispRows) {
        index += this.dispRows 
        continue
      }

      this.dataObject[index] = this.dataParams.data.slice(index, (this.dispRows + index))
      index   += this.dispRows 
    }

    if (this.pendingRequest) this.setTableData()
  }

  /**
  * Calls table instance function to set table data
  * (calls TableDataMgrListener's loadMore if data is not present)
  */
  setTableData(index ?: number) {

    if (index) this.currentKeyIndex = index

    const keys = Object.keys(this.dataObject)

    const dataKey = keys.find((key) => {
      return Number(key) === this.currentKeyIndex
    })

    if (dataKey) {
      const data : Array<Object> = this.dataObject[dataKey]

      if (data.length === this.dispRows || (this.totalDataCount - this.currentKeyIndex) < this.dispRows) {
        this.tableInst.setDisplayData(data)
        this.lastKeyIndex = Number(dataKey)
      } else {
        const index : number = this.currentKeyIndex + data.length
        this.parentInst.loadMore(index)
        this.pendingRequest = true
      }

      return
    }

    this.parentInst.loadMore(this.currentKeyIndex)
    this.pendingRequest = true
  }

  /**
  * Call from parent, clears all the data inside the manager
  */
  clearData() {
    this.totalDataCount   = 0
    this.dispRows         = 0
    this.currentKeyIndex  = 0
    this.dataParams       = {} as TableDataManagerParams
    this.dataObject       = {}
    this.pendingRequest   = false
  }

  /**
  * Method to update the data if parent wants to change any particular data in the data table
  * @param data : data on which the action should be done
  * @param index : index where the data is present
  */
  updateDataStatus(data : Mubble.uObject<any>, index : number) {
    const dataIndex : number = index - this.currentKeyIndex
    this.dataObject[this.currentKeyIndex][dataIndex] = data
    this.setTableData()
  }

  /**
  * Method called by parent when error occur in parent
  */
  errorOccur() {
    this.pendingRequest   = false
    this.currentKeyIndex  = this.lastKeyIndex
    // this.tableInst.onUiError()
    this.setTableData()
  }

  /**
  * Method called by parent 
  * user selects different data in the data table to pass whether the data should be selectable or not
  * @param data : To select the data in the data table
  */
  setSelectableData(data : Array<Object>) {
    this.tableInst.setSelectedItems(data)
  }
}