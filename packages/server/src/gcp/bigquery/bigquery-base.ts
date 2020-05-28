/*------------------------------------------------------------------------------
   About      : Bigquery model decorators
   
   Created on : Thu Feb 27 2020
   Author     : Siddharth Garg
   
   Copyright (c) 2020 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { BqRegistryManager }          from "./bigquery-registry"

type UnionKeyToValue<U extends string> = {
  [K in U]: K
}

export namespace BqBase {
  
  export type FIELD_TYPE = 'INTEGER' | 'FLOAT' | 'STRING' | 'TIMESTAMP' | 'RECORD'
  export const FIELD_TYPE :UnionKeyToValue<FIELD_TYPE> = {
    INTEGER   : 'INTEGER',
    FLOAT     : 'FLOAT',
    STRING    : 'STRING',
    TIMESTAMP : 'TIMESTAMP',
    RECORD    : 'RECORD'
  }

  export type FIELD_MODE = 'NULLABLE' | 'REPEATED'
  export const FIELD_MODE :UnionKeyToValue<FIELD_MODE> = {
    NULLABLE : 'NULLABLE',
    REPEATED : 'REPEATED'
  }

  /**
   *  Annotation to mark a Bq model.
   *  Make sure the table name is same as the name of the class in lower case.
   */
  export function model(dataset: string, dayPartition : boolean = false, version ?: number) {
    return function(target: any) {
      BqRegistryManager.addEntity(dataset, target.name.toLowerCase(), 
                                  dayPartition, version)
    }
  }

  /**
   *  Annotation to mark a Bq model field.
   */
  export function field(type : FIELD_TYPE = FIELD_TYPE.STRING,
                        mode : FIELD_MODE = FIELD_MODE.NULLABLE) {

    return function(target : any , propertyKey : string) {
      BqRegistryManager.addField(target.constructor.name.toLowerCase(), 
                                 propertyKey, type, mode)
    }
  }

  export function recordField(parent  : string,
                              type    : FIELD_TYPE = FIELD_TYPE.STRING,
                              mode    : FIELD_MODE = FIELD_MODE.NULLABLE) {

    return function(target : any , propertyKey : string) {
      BqRegistryManager.addRecordField(target.constructor.name.toLowerCase(), 
                                       parent, propertyKey, type, mode)
    }
  }

}