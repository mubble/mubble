/*------------------------------------------------------------------------------
   About      : Utility functions used in Muds
   
   Created on : Mon Jun 18 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {  
          Muds, 
          FieldType,
          DatastoreInt, 
          DatastoreKey, 
          DsRec, 
          EntityType
       }                                from './muds'
import {  
          MudsEntityInfo, 
          MeField
       }                                from './muds-manager'
import {  
          MudsBaseStruct,
          MudsBaseEntity
       }                                from './muds-base-entity'
import {  Mubble }                      from '@mubble/core'
import {  RunContextServer }            from '../..'

export class MudsUtil {

  private static targetDateTs = 2544912000000  //24-8-2050 (GMT)

  public static isClassStruct(cls: any) {
    return Muds.BaseStruct.prototype.isPrototypeOf(cls.prototype)
  }

  // Either array or a field can be MudsStruct
  public static getStructClass(me: MeField): Muds.IBaseStruct<MudsBaseStruct> | null {
    if (MudsUtil.isClassStruct(me.fieldType)) return me.fieldType as any
    if (me.fieldType === Array && MudsUtil.isClassStruct(me.typeHint)) return me.typeHint as any
    return null
  }

  // verifies in a dotted field whether the whole path is indexed
  public static checkIndexed(rc: RunContextServer, entityInfoMap: Mubble.uObject<MudsEntityInfo>, 
                dottedStr: string, inEntityName: string) {

    const props       = dottedStr.split('.')

    let entityName  = inEntityName, meField

    for (let index = 0; index < props.length; index++) {

      const prop = props[index],
            info = entityInfoMap[entityName]

      rc.isAssert() && rc.assert(rc.getName(this), info, 
        `'${entityName}' is not found in entityInfo. Used in '${dottedStr}' of entity '${inEntityName}'`)

      meField   = info.fieldMap[prop]
      const Cls = this.getStructClass(meField)

      rc.isAssert() && rc.assert(rc.getName(this), meField.indexed, 
        `'${prop}' is not indexed in path '${dottedStr}' of entity '${inEntityName}'`)

      !Cls && rc.isAssert() && rc.assert(rc.getName(this), index === props.length - 1, 
        `'${prop}' is not indexed in path '${dottedStr}' of entity '${inEntityName}'`)

      if (Cls) entityName = Cls.name
    }
    return meField
  }

  public static getReferredField(rc: RunContextServer, entityInfoMap: Mubble.uObject<MudsEntityInfo>, 
                                  dottedStr: string, inEntityName: string) {

    return this.checkIndexed(rc, entityInfoMap, dottedStr, inEntityName)
  }

  public static getMpoc(ts ?: number) {
    
    return MudsUtil.targetDateTs - (ts || Date.now())
  }

  public static getUniques(rc : RunContextServer, entity : MudsBaseStruct, uniques : Array<Object>, prefix ?: string) { 
    
    const entityInfo = entity.getInfo()

    for (const fieldName of entityInfo.fieldNames) {

      const meField = entityInfo.fieldMap[fieldName]
      let   value   = (entity as any)[fieldName]
      
      if (value && meField.unique) {
        const uniqueKey = prefix ? `${prefix}.${meField.fieldName}` : meField.fieldName,
              Cls       = MudsUtil.getStructClass(meField)
              
        if (Cls && meField.indexed) {
          value = meField.fieldType === Array ? value : [value]
          value.forEach((struct: MudsBaseStruct) => this.getUniques(rc, struct, uniques, uniqueKey))
        }

        uniques.push({entity : entity, key : uniqueKey, value : value})
      }
    }

    return uniques.length
  }
}
