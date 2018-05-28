/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Wed May 16 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import * as Datastore                   from '@google-cloud/datastore'
import * as DsEntity                    from '@google-cloud/datastore/entity'

import {  GcloudEnv }                   from '../../gcp/gcloud-env'
        
import {  RunContextServer  }           from '../../rc-server'
import * as lo                          from 'lodash'
import { Mubble }                       from '@mubble/core'
import {  MeField,         
          MudsManager,
          DatastorePayload,         
          MudsEntityInfo }              from './muds-manager'
import { Muds, DatastoreInt, DsRec }           from '..'

export class MudsBaseEntity {

  private ancestorKeys  : (string | DatastoreInt) []
  private selfKey       : string | DatastoreInt | undefined

  private editing       : boolean  // indicates editing is undergoing for this entity
  private savePending   : boolean  // indicates that entity is pending to be saved
  private fromDs        : boolean
  private entityInfo    : MudsEntityInfo

  constructor(private rc: RunContextServer, private manager: MudsManager,
              keys ?: (string | DatastoreInt)[], recObj ?: Mubble.uObject<any>) {
    this.entityInfo  = this.manager.getInfo(this.constructor)
    if (keys) {
      this.setKey(keys)
      if (recObj) this.constructFromRecord(recObj)
    }
  }

  /// Is under editing
  public isEditing() {
    return this.editing
  }

  public edit() {
    if (this.editing) throw('Cannot enter the editing mode while already editing')
    this.editing = true
  }

  public discardEditing() {
    if (!this.editing) throw('Cannot discard edit when not editing')

    const fieldNames  = this.entityInfo.fieldNames

    for (const fieldName of fieldNames) {
      const meField = this.entityInfo.fieldMap[fieldName]
      meField.accessor.resetter(this)
    }

    this.editing = false
  }

  /** 
   * indicates that entity was either fetched from db Or was created new 
   * and then inserted into db: Essentially denoting this instance of 
   * entity is from db
  */ 
  public isFromDs() {
    return this.fromDs
  }

  // Has been queued up for saving. Another edit would not be permitted on this
  public isSavePending() {
    return this.savePending
  }

  /* ---------------------------------------------------------------------------
   P R I V A T E    C O D E    S E C T I O N     B E L O W

   D O   N O T   A C C E S S   D I R E C T L Y
  -----------------------------------------------------------------------------*/

  /**
   * Is internally called to set key for insert record. 
   * Get also uses this function via a separate function to align key format
   */
  setKey(keys: (string | DatastoreInt) [] ) {

    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), 
      !this.ancestorKeys && !this.selfKey)

    const {ancestorKeys, selfKey} = this.manager.separateKeys(this.rc, 
      this.entityInfo, this.entityInfo.ancestors, keys)

    this.ancestorKeys = ancestorKeys
    this.selfKey = selfKey    
  }

  constructFromRecord(recObj: DsRec) {

    const fieldNames = this.entityInfo.fieldNames
    for (const fieldName of fieldNames) {
      const accessor  = this.entityInfo.fieldMap[fieldName].accessor
      //accessor.setForDs(this.rc, this, dsRec)
    }
    
  }

}

/* ---------------------------------------------------------------------------
  FieldAccessor: Does all field level I/O

  P R I V A T E    C O D E    S E C T I O N     C O N T I N U E S
-----------------------------------------------------------------------------*/
export class FieldAccessor {

  readonly ovFieldName : string // original value field name
  readonly cvFieldName : string // current  value field name

  constructor(private entityName: string, private fieldName: string, private meField: MeField) {
    this.ovFieldName = '$$' + fieldName
    this.cvFieldName  = '$' + fieldName
  }

  private getter(entity: any) {
    console.log(`${this.getId()}: getter`)
    return entity[this.cvFieldName]
  }

  private getId() {
    return `${this.entityName}/${this.fieldName}`
  }

  setter(entity: any, newValue: any) {

    const meField = this.meField
    if (!entity.editing) throw('${this.getId()}: You cannot edit an entity without calling edit() on it first')

    if (newValue === undefined) {
      if (meField.mandatory) throw(`${this.getId()}: Mandatory field cannot be set to undefined`)
    } else {
      // basic data type
      if ([Number, String, Boolean].indexOf(meField.fieldType as any) !== -1) {
        if (newValue === null) throw(`${this.getId()}: Base data types cannot be set to null`)
        if (newValue.constructor !== meField.fieldType) {
          throw(`${this.getId()}: ${meField.fieldType.name} field cannot be set to ${newValue}/${typeof newValue}`)
        }
      // object data type 
      } else if (newValue !== null && !(
                 meField.fieldType.prototype.isPrototypeOf(newValue) ||
                 meField.fieldType.prototype.isPrototypeOf(newValue.constructor.prototype))) {
        throw(`${this.getId()}: cannot be set to incompatible type ${
          newValue.constructor.name} does not extend ${meField.fieldType.name}`)
      }
    }

    if (!entity[this.ovFieldName]) entity[this.ovFieldName] = {original: entity[this.cvFieldName]}
    console.log(`${this.getId()}: setter called with ${newValue}`)
    entity[this.cvFieldName] = newValue
  }

  resetter(entity: any) {
    var originalValueObj = entity[this.ovFieldName]
    if (originalValueObj) {
      entity[this.cvFieldName] = originalValueObj.original
      entity[this.ovFieldName] = undefined
    }
  }

  getAccessor() {
    const accessor = this
    return {
      get     : function() { return accessor.getter(this) },
      set     : function(value: any) { accessor.setter(this, value) }
    }
  }

  setForDs(rc: RunContextServer, entity: any, dsRec: DatastorePayload) {

    this.checkMandatory(rc, entity)

    const value = entity[this.cvFieldName]
    if (value === undefined) return

    dsRec.data[this.fieldName] = value

    if (this.meField.indexed || this.meField.unique) {
      dsRec.excludeFromIndexes.push(this.fieldName)
    }
  }

  checkMandatory(rc: RunContextServer, entity: any) {

    if (!this.meField.mandatory) return true
    rc.isAssert() && rc.assert(rc.getName(this), 
      entity[this.cvFieldName] === undefined, 
      `${this.getId()}: mandatory field must not be undefined`)
    return true
  }

  loadFromDs(rc: RunContextServer, entity: any, newValue: any) {

    const meField = this.meField
    if (!entity.editing) throw('${this.getId()}: You cannot edit an entity without calling edit() on it first')

    if (newValue === undefined) {
      if (meField.mandatory) throw(`${this.getId()}: Mandatory field cannot be set to undefined`)
    } else {
      // basic data type
      if ([Number, String, Boolean].indexOf(meField.fieldType as any) !== -1) {
        if (newValue === null) throw(`${this.getId()}: Base data types cannot be set to null`)
        if (newValue.constructor !== meField.fieldType) {
          throw(`${this.getId()}: ${meField.fieldType.name} field cannot be set to ${newValue}/${typeof newValue}`)
        }
      // object data type 
      } else if (newValue !== null && !(
                 meField.fieldType.prototype.isPrototypeOf(newValue) ||
                 meField.fieldType.prototype.isPrototypeOf(newValue.constructor.prototype))) {
        throw(`${this.getId()}: cannot be set to incompatible type ${
          newValue.constructor.name} does not extend ${meField.fieldType.name}`)
      }
    }

    if (!entity[this.ovFieldName]) entity[this.ovFieldName] = {original: entity[this.cvFieldName]}
    console.log(`${this.getId()}: setter called with ${newValue}`)
    entity[this.cvFieldName] = newValue
  }
  


  


}

