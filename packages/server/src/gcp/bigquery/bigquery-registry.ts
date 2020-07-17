/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Thu Feb 27 2020
   Author     : Siddharth Garg
   
   Copyright (c) 2020 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { BqBase, 
          TABLE_OPTIONS   }    from './bigquery-base'
import { RunContextServer }    from '../../rc-server'
import { Mubble }              from '@mubble/core'

/*------------------------------------------------------------------------------
   Bigquery Field Info
------------------------------------------------------------------------------*/

export type BqFieldInfo = {
  name    : string
  type    : BqBase.FIELD_TYPE
  mode    : BqBase.FIELD_MODE
  parent ?: string
  fields ?: BqFieldInfo[]
}

/*------------------------------------------------------------------------------
   Obmop Registry
------------------------------------------------------------------------------*/

export class BigqueryRegistry {

  private dataset       : string
  private tableName     : string
  private partition     : boolean = false
  private version      ?: number
  private fields        : Array<BqFieldInfo> = []
  private tableOptions ?: TABLE_OPTIONS

  constructor(table: string) {
    this.tableName = table
  }

  init(dataset: string, options ?: TABLE_OPTIONS, version ?: number) {
    this.dataset        = dataset
    this.partition      = false
    if (options) {
      this.partition    = options.timePartitioning ? true : false
      this.tableOptions = options
    }
    this.version        = version
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

    this.fields.push(field)
  }

  getFields() : Array<BqFieldInfo> {
    return this.fields
  }

  getNotNullFields() : Array<BqFieldInfo> {
    return this.fields.filter((field : BqFieldInfo) => field.mode != BqBase.FIELD_MODE.NULLABLE)
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

  isPartition(): boolean {
    return this.partition
  }

  getVersion(): number | undefined {
    return this.version
  }

  getOptions() : TABLE_OPTIONS | undefined {
    return this.tableOptions
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
                          options ?: TABLE_OPTIONS, version ?: number) {

    const registry : BigqueryRegistry  = this.getRegistry(tableName)
    registry.init(dataset, options, version)
  }

  public static addField(tableName  : string,
                         fieldName  : string,
                         fieldType  : BqBase.FIELD_TYPE,
                         fieldMode  : BqBase.FIELD_MODE) {

    const registry  : BigqueryRegistry  = this.getRegistry(tableName),
          fieldInfo : BqFieldInfo = {
                                         name    : fieldName,
                                         type    : fieldType,
                                         mode    : fieldMode
                                       }

    registry.addField(fieldInfo)
  }

  public static addRecordField(tableName  : string,
                               parent     : string,
                               fieldName  : string,
                               fieldType  : BqBase.FIELD_TYPE,
                               fieldMode  : BqBase.FIELD_MODE) {

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