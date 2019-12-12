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
  name       : string
  type       : Obmop.FieldType
  unique     : boolean
  indexed    : boolean
  serial     : boolean
}

/*------------------------------------------------------------------------------
   Obmop Registry
------------------------------------------------------------------------------*/

export class ObmopRegistry {
  private tableName  : string
  private fields     : Array<ObmopFieldInfo> = []
  private primaryKey : string

  constructor(table : string) {
    this.tableName = table
  }

  addField(field : ObmopFieldInfo) {
    if(field.name != field.name.toLowerCase()) {
      throw new Mubble.uError(DB_ERROR_CODE,
                              `Field ${field.name} has upper case characters in table ${this.tableName}.`)
    }

    if(field.type === Obmop.FieldType.PRIMARY) {
      if(this.primaryKey) {
        throw new Mubble.uError(DB_ERROR_CODE, `Trying to add more than one primary key in table ${this.tableName}.`)
      }

      this.primaryKey = field.name
    }

    this.fields.push(field)
  }

  getPrimaryKey() : string {
    return this.primaryKey
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

  getSerializedFields() : Array<ObmopFieldInfo> {
    return this.fields.filter((field : ObmopFieldInfo) => field.serial)
  }

  getNotNullFields() : Array<ObmopFieldInfo> {
    return this.fields.filter((field : ObmopFieldInfo) => field.type != Obmop.FieldType.OPTIONAL)
  }

  getFieldNames() : Array<string> {
    return this.fields.map((field : ObmopFieldInfo) => field.name)
  }

  getFieldInfo(field : string) : ObmopFieldInfo {
    const info = this.fields.find((f : ObmopFieldInfo) => f.name === field)

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
                         unique     : boolean,
                         indexed    : boolean,
                         serial     : boolean) {

    const registry  : ObmopRegistry  = this.getRegistry(entity),
          fieldInfo : ObmopFieldInfo = {
                                            name       : fieldName,
                                            type       : fieldType,
                                            unique     : unique,
                                            indexed    : indexed,
                                            serial     : serial
                                          }

    registry.addField(fieldInfo)
  }

  public static getRegistry(entity : string) : ObmopRegistry {
    if(!this.regMap[entity]) this.regMap[entity] = new ObmopRegistry(entity)

    return this.regMap[entity]
  }
}