/*------------------------------------------------------------------------------
   About      : Obmop registry and registry manager
   
   Created on : Thu Jun 20 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import { RunContextServer }       from '../../rc-server'
import { Obmop }                  from './obmop-base'
import { DB_ERROR_CODE }          from './obmop-util'
import { Mubble }                 from '@mubble/core'

/*------------------------------------------------------------------------------
   Obmop Field Info
------------------------------------------------------------------------------*/

export type ObmopFieldInfo = {
  name      : string
  mapping   : string
  type      : Obmop.FieldType
  dataType  : string
  unique    : boolean
  indexed   : boolean
  serial    : boolean
  lob       : boolean
  sequence ?: string
}

export type ObmopFieldNameMapping = {
  name    : string
  mapping : string
}

/*------------------------------------------------------------------------------
   Obmop Registry
------------------------------------------------------------------------------*/

export class ObmopRegistry {
  private tableName         : string
  private fields            : Array<ObmopFieldInfo> = []
  private primaryKey        : string
  private primaryKeyMapping : string

  constructor(table : string) {
    this.tableName = table
  }

  addField(field : ObmopFieldInfo) {

    if(field.type === Obmop.FieldType.PRIMARY) {
      if(this.primaryKey) {
        throw new Mubble.uError(DB_ERROR_CODE, `Trying to add more than one primary key in table ${this.tableName}.`)
      }

      this.primaryKey        = field.name
      this.primaryKeyMapping = field.mapping
    }

    this.fields.push(field)
  }

  getPrimaryKey() : { name : string, mapping : string } {
    return { name : this.primaryKey, mapping : this.primaryKeyMapping }
  }

  getPrimaryKeyInfo() : ObmopFieldInfo {
    const info = this.fields.find((f : ObmopFieldInfo) => f.name === this.primaryKey)

    if(!info) {
      throw new Mubble.uError(DB_ERROR_CODE, `Primary key doesnot exsist in table ${this.tableName}.`)
    }

    return info
  }

  getFields() : Array<ObmopFieldInfo> {
    return this.fields
  }

  getFieldMapping(name : string) : string {
    const field = this.fields.find((f : ObmopFieldInfo) => f.name === name)

    if(!field) {
      throw new Mubble.uError(DB_ERROR_CODE, `Field doesnot exsist in table ${this.tableName}.`)
    }

    return field.mapping
  }

  getSerializedFields() : Array<ObmopFieldInfo> {
    return this.fields.filter((field : ObmopFieldInfo) => field.serial)
  }

  getSequenceFields() : Array<ObmopFieldInfo> {
    return this.fields.filter((field : ObmopFieldInfo) => field.sequence)
  }

  getNotNullFields() : Array<ObmopFieldInfo> {
    return this.fields.filter((field : ObmopFieldInfo) => field.type != Obmop.FieldType.OPTIONAL)
  }

  getLobFields() : Array<ObmopFieldInfo> {
    return this.fields.filter((field : ObmopFieldInfo) => field.lob)
  }

  getFieldInfo(field : string) : ObmopFieldInfo {
    const info = this.fields.find((f : ObmopFieldInfo) => f.mapping === field)

    if(!info) {
      throw new Mubble.uError(DB_ERROR_CODE, `Field ${field} doesnot exsist in table ${this.tableName}.`)
    }

    return info
  }
}

/*------------------------------------------------------------------------------
   Obmop Registry Manager
------------------------------------------------------------------------------*/

export class ObmopRegistryManager {

  private static regMap : Mubble.uObject<ObmopRegistry> = {}

  public static init(rc : RunContextServer) {
    rc.isDebug() && rc.debug(rc.getName(this), 'Initializing ObmopRegistryManager.')
    this.regMap = {}
  }

  public static addEntity(entity : string) {
    this.regMap[entity] = new ObmopRegistry(entity)
  }

  public static addField(entity     : string,
                         fieldName  : string,
                         fieldType  : Obmop.FieldType,
                         dataType   : string,
                         unique     : boolean,
                         indexed    : boolean,
                         serial     : boolean,
                         lob        : boolean,
                         sequence  ?: string) {

    const registry  : ObmopRegistry  = this.getRegistry(entity),
          fieldInfo : ObmopFieldInfo = {
                                         name    : fieldName,
                                         mapping : fieldName.toLowerCase(),
                                         type    : fieldType,
                                         dataType,
                                         unique,
                                         indexed,
                                         serial,
                                         lob,
                                         sequence 
                                       }

    registry.addField(fieldInfo)
  }

  public static getRegistry(entity : string) : ObmopRegistry {
    if(!this.regMap[entity]) this.regMap[entity] = new ObmopRegistry(entity)

    return this.regMap[entity]
  }
}