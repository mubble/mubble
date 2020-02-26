/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Thu Feb 27 2020
   Author     : Siddharth Garg
   
   Copyright (c) 2020 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { BigqueryBase }          from './bigquery-base'
import { RunContextServer }       from '../../rc-server'
import { Mubble }                 from '@mubble/core'

/*------------------------------------------------------------------------------
   Bigquery Field Info
------------------------------------------------------------------------------*/

export type BqFieldInfo = {
  name    : string
  type    : BigqueryBase.FIELD_TYPE
  mode    : BigqueryBase.FIELD_MODE
  parent ?: string
  fields ?: BqFieldInfo[]
}

/*------------------------------------------------------------------------------
   Obmop Registry
------------------------------------------------------------------------------*/

export class BigqueryRegistry {

  private dataset       : string
  private tableName     : string
  private dayPartition  : boolean = false
  private version      ?: number
  private fields        : Array<BqFieldInfo> = []

  constructor(table: string) {
    this.tableName = table
  }

  init(dataset: string, dayPartition : boolean = false, version ?: number) {
    this.dataset      = dataset
    this.dayPartition = dayPartition
    this.version      = version
  }

  addField(field : BqFieldInfo) {
    if(field.name != field.name.toLowerCase()) {
      throw new Mubble.uError("BQ_ERROR_CODE",
                              `Field ${field.name} has upper case characters in table ${this.tableName}.`)
    }

    this.fields.push(field)
  }

  addRecordField(field : BqFieldInfo) {

    if(field.name != field.name.toLowerCase()) {
      throw new Mubble.uError("BQ_ERROR_CODE",
                              `Field ${field.name} has upper case characters in table ${this.tableName}.`)
    }

    const parentField = this.fields.find((fld) => fld.name === field.parent)
    if (!parentField!!.fields) parentField!!.fields = []
    parentField!!.fields.push(field)
  }

  getFields() : Array<BqFieldInfo> {
    return this.fields
  }

  getNotNullFields() : Array<BqFieldInfo> {
    return this.fields.filter((field : BqFieldInfo) => field.mode != BigqueryBase.FIELD_MODE.NULLABLE)
  }

  getFieldNames() : Array<string> {
    return this.fields.map((field : BqFieldInfo) => field.name)
  }

  getFieldInfo(field : string) : BqFieldInfo {
    const info = this.fields.find((f : BqFieldInfo) => f.name === field)

    if(!info) {
      throw new Mubble.uError(`BQ_SCHEMA_MISMATCH`, `Field ${field} doesnot exsist in table ${this.tableName}.`)
    }

    return info
  }

  getDataset(): string {
    return this.dataset
  }

  getTableName(): string {
    return this.tableName
  }

  isDayPartition(): boolean {
    return this.dayPartition
  }

  getVersion(): number | undefined {
    return this.version
  }
}

/*------------------------------------------------------------------------------
   Obmop Registry Manager
------------------------------------------------------------------------------*/

export class BqRegistryManager {

  private static regMap : Mubble.uObject<BigqueryRegistry> = {}

  public static init(rc : RunContextServer) {
    rc.isDebug() && rc.debug(rc.getName(this), 'Initializing BqRegistryManager.')
    this.regMap = {}
  }

  public static addEntity(dataset: string, tableName : string, 
                          dayPartition: boolean = false, version ?: number) {

    const registry : BigqueryRegistry  = this.getRegistry(tableName)
    registry.init(dataset, dayPartition, version)
  }

  public static addField(tableName  : string,
                         fieldName  : string,
                         fieldType  : BigqueryBase.FIELD_TYPE,
                         fieldMode  : BigqueryBase.FIELD_MODE) {

    const registry  : BigqueryRegistry  = this.getRegistry(tableName),
          fieldInfo : BqFieldInfo = {
                                         name    : fieldName,
                                         type    : fieldType,
                                         mode    : fieldMode
                                       }

    registry.addField(fieldInfo)
  }

  public static addRecord(tableName  : string,
                          fieldName  : string,
                          fieldMode  : BigqueryBase.FIELD_MODE) {

    const registry  : BigqueryRegistry  = this.getRegistry(tableName),
          fieldInfo : BqFieldInfo = {
                                      name    : fieldName,
                                      type    : BigqueryBase.FIELD_TYPE.RECORD,
                                      mode    : fieldMode
                                    }
    registry.addField(fieldInfo)
  }

  public static addRecordField(tableName  : string,
                               parent     : string,
                               fieldName  : string,
                               fieldType  : BigqueryBase.FIELD_TYPE,
                               fieldMode  : BigqueryBase.FIELD_MODE) {

    const registry  : BigqueryRegistry  = this.getRegistry(tableName),
          fieldInfo : BqFieldInfo = {
                                      name    : fieldName,
                                      type    : fieldType,
                                      mode    : fieldMode,
                                      parent  : parent
                                    }

    registry.addRecordField(fieldInfo)
  }

  public static getRegistry(tableName : string) : BigqueryRegistry {

    if(!this.regMap[tableName]) this.regMap[tableName] = new BigqueryRegistry(tableName)
    return this.regMap[tableName]
  }
}