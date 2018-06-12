/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Wed May 16 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import * as Datastore                   from '@google-cloud/datastore'
import * as DsEntity                    from '@google-cloud/datastore/entity'
import * as lo                          from 'lodash'

import {  GcloudEnv }                   from '../../gcp/gcloud-env'
        
import {  RunContextServer  }           from '../../rc-server'
import {  Mubble }                       from '@mubble/core'
import {  MeField,         
          MudsManager,
          DatastorePayload,         
          MudsEntityInfo }              from './muds-manager'
import {  Muds, 
          DatastoreInt, 
          DsRec, 
          EntityType}                       from '..'

export class MudsBaseEntity {

  private ancestorKeys  : (string | DatastoreInt) []
  private selfKey       : string | DatastoreInt | undefined

  private editing       : boolean  // indicates editing is undergoing for this entity
  private savePending   : boolean  // indicates that entity is pending to be saved
  private fromDs        : boolean
  private entityInfo    : MudsEntityInfo

  constructor(private rc: RunContextServer, private manager: MudsManager,
              keys: (string | DatastoreInt)[], recObj: Mubble.uObject<any>, 
              fullRec: boolean) {
    this.entityInfo  = this.manager.getInfo(this.constructor)
    if (keys) {
      if (recObj) {
        this.constructFromRecord(keys, recObj, fullRec)
        this.fromDs = true
      } else {
        const {ancestorKeys, selfKey} = this.manager.separateKeysForInsert(this.rc, 
                                          this.entityInfo.cons, keys)
        this.ancestorKeys = ancestorKeys
        this.selfKey      = selfKey
      }
    }

    if (!(this.entityInfo.keyType === Muds.Pk.Auto || this.entityInfo.keyType === Muds.Pk.None)) {
      rc.isAssert() && rc.assert(rc.getName(this), this.selfKey, `Cannot create entity without keys`)
    }
  }

  public isEditing() {
    return this.editing
  }

  public edit() {
    if (this.editing) throw('Cannot enter the editing mode while already editing')
    this.editing = true
  }

  public hasValidKey() {
    return !!this.selfKey
  }

  public isModified() {
    const fieldNames = this.entityInfo.fieldNames
    for (const fieldName of fieldNames) {
      const accessor  = this.entityInfo.fieldMap[fieldName].accessor
      if (accessor.isModified(this)) return true
    }
    return false
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

  public getLogId(): string {
    return `${this.entityInfo.entityName}:${this.ancestorKeys}/${this.selfKey}`
  }

  public getFullKey(): (string | DatastoreInt) [] {
    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), this.ancestorKeys && this.selfKey)
    const ar = this.ancestorKeys.map(item => item)
    ar.push(this.selfKey as any)
    return ar
  }

  /* ---------------------------------------------------------------------------
   P R I V A T E    C O D E    S E C T I O N     B E L O W

   D O   N O T   A C C E S S   D I R E C T L Y
  -----------------------------------------------------------------------------*/
  constructFromRecord(keys: (string | DatastoreInt)[], recObj: DsRec, fullRec: boolean) {

    if (this.entityInfo.keyType !== Muds.Pk.None) {
      const {ancestorKeys, selfKey} = this.manager.separateKeys(this.rc, this.entityInfo.cons, keys)
      this.ancestorKeys = ancestorKeys
      this.selfKey      = selfKey

      this.rc.isAssert() && this.rc.assert(this.rc.getName(this), this.selfKey)
    }

    const fieldNames  = this.entityInfo.fieldNames
    for (const fieldName of fieldNames) {
      const meField   = this.entityInfo.fieldMap[fieldName],
            accessor  = meField.accessor

      accessor.loadFromDs(this.rc, this, recObj[fieldName], fullRec)
    }
  }

  getInfo() {
    return this.entityInfo
  }

  getAncestorKey() {
    return this.ancestorKeys
  }

  getSelfKey() {
    return this.selfKey
  }

  // The path may be of multiple undocumented form, handling all of them here
  commitUpsert(path: any) {

    this.editing = false
    this.fromDs  = true

    const fieldNames = this.entityInfo.fieldNames,
          keyType    = this.entityInfo.keyType,
          entityName = this.entityInfo.entityName

    for (const fieldName of fieldNames) {
      const accessor  = this.entityInfo.fieldMap[fieldName].accessor
      accessor.commitUpsert(this) // erase old values as the record is committed to ds now
    }

    !this.selfKey && this.entityInfo.keyType !== Muds.Pk.None && 
      this.rc.isAssert() && this.rc.assert(this.rc.getName(this), path)
    if (!path) return

    if (path.length) path = path[path.length - 1]
    if (typeof(path) === 'string') {
      this.selfKey = keyType === Muds.Pk.String ? path : Muds.getIntKey(path)
    } else if (path.id && keyType !== Muds.Pk.String) {
      this.rc.isAssert() && this.rc.assert(this.rc.getName(this), entityName === path.kind, path)
      this.selfKey = Muds.getIntKey(path.id)
    } else if (path.name && keyType === Muds.Pk.String) {
      this.rc.isAssert() && this.rc.assert(this.rc.getName(this), entityName === path.kind, path)
      this.selfKey = path.name
    }
    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), this.selfKey, path)
  }

  $dump() {
    console.log(this.toString())
  }

  public toString() {

    const entityInfo = this.entityInfo,
          aks        = this.ancestorKeys

    let str = `------ ${entityInfo.entityName} -------\n`

    if (aks && aks.length) {
      const ancestorsInfo = entityInfo.ancestors
      str += this.$rowHead('ancestors')
      for (const [index, info] of ancestorsInfo.entries()) {
        str += this.$key(info, aks[index])
      }
      str += '\n'
    }
    str += this.$rowHead('key') + 
           `${this.$key(entityInfo, this.selfKey)}\n`

    for (const fieldName of entityInfo.fieldNames) {
      const meField = entityInfo.fieldMap[fieldName],
            headEntry = (meField.mandatory ? '*' : '') + 
                        `${fieldName}/${meField.accessor.$getSubtype()}` + 
                        (meField.unique ? '+' : (meField.indexed ? '@' : '')) 
                        
      str += this.$rowHead(headEntry) + 
        `[${ meField.accessor.$printField(this)}]\n`
    }
    return str
  }

  private $key(info: MudsEntityInfo, key: undefined | string | DatastoreInt) {
    return ` ${info.entityName} (${key ? (info.keyType === Muds.Pk.String ? `"${key}"` : 
      ('Int: ' + (key as DatastoreInt).value)) : key })`
  }

  private $rowHead(str: string) {
    return lo.padEnd(lo.padStart(str, 2), 24) + ' => '
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
    this.ovFieldName = '_$$_' + fieldName
    this.cvFieldName  = '_$_' + fieldName
  }

  private getter(inEntity: MudsBaseEntity) {
    return (inEntity as any)[this.cvFieldName]
  }

  private getId() {
    return `${this.entityName}/${this.fieldName}`
  }

  setter(inEntity: MudsBaseEntity, newValue: any) {

    const entity = inEntity as any
    if (!entity.editing) throw(this.getId() + ' You cannot edit an entity without calling edit() on it first')

    // when there is no change
    if (entity[this.cvFieldName] === newValue) return

    const meField = this.meField
    if (newValue === undefined) {
      if (meField.mandatory) throw(this.getId() + ' Mandatory field cannot be set to undefined')
    } else {
      this.validateType(newValue)
    }

    if (!entity[this.ovFieldName]) entity[this.ovFieldName] = {original: entity[this.cvFieldName]}
    entity[this.cvFieldName] = newValue
  }

  validateType(newValue: any) {

    if (this.meField.isArray) {
      const arValues = newValue as any[]
      if (!Array.isArray(newValue)) throw(this.getId() + ' is not an array')
      for (const value of arValues) {
        if (value === undefined || value === null) throw(`${this.getId()}: cannot have ${value}`)
        this.validateInsType(value, this.meField.subtype)
      }
    } else {
      this.validateInsType(newValue, this.meField.subtype)
    }
 
  }

  private validateInsType(newValue: any, subtype: Muds.Subtype) {

    if (subtype === Muds.Subtype.embedded) {
      if (!Muds.BaseEntity.isPrototypeOf(newValue)) throw(`${this.getId()}: must be MudsEntity`)
      const be   = newValue as Muds.BaseEntity,
            info = be.getInfo()
      if (info.entityType !== EntityType.Embedded)  throw(`${this.getId()}: must be Embedded Entity`)
    } else {
      if (!!(subtype & (Muds.TypeMap.get(newValue.constructor) || 0))) {
        throw(`${this.getId()}: cannot be set to ${newValue}/${typeof newValue}`)
      }
    }
  }

  resetter(inEntity: MudsBaseEntity) {

    const entity            = inEntity as any,
          originalValueObj  = entity[this.ovFieldName]

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

  setForDs(rc: RunContextServer, inEntity: MudsBaseEntity, dsRec: DatastorePayload) {

    this.checkMandatory(rc, inEntity)

    const entity = inEntity as any

    const value = entity[this.cvFieldName]
    if (value === undefined) return

    dsRec.data[this.fieldName] = value
    this.buildExclusions(value, '', dsRec.excludeFromIndexes)
  }

  private buildExclusions(value: any, prefix: string, arExclude: string[]) {

    if (value instanceof MudsBaseEntity) {

      const embedInfo = value.getInfo()

      for (const cfName of embedInfo.fieldNames) {
        const cAccessor = embedInfo.fieldMap[cfName].accessor,
              cValue    = (value as any)[this.fieldName]
        cAccessor.buildExclusions(cValue, (prefix ? prefix + '.' : '') + cfName, arExclude)
      }

    } else if (!(this.meField.indexed || this.meField.unique)) {
      arExclude.push((prefix ? prefix + '.' : '') + this.fieldName)
    }
  }

  isModified(inEntity: MudsBaseEntity) {
    return !!(inEntity as any)[this.ovFieldName]
  }

  checkMandatory(rc: RunContextServer, inEntity: MudsBaseEntity) {

    if (!this.meField.mandatory) return true

    const entity = inEntity as any
    rc.isAssert() && rc.assert(rc.getName(this), 
      entity[this.cvFieldName] !== undefined, 
      `${this.getId()}: mandatory field must not be undefined`)
    return true
  }

  loadFromDs(rc: RunContextServer, inEntity: MudsBaseEntity, newValue: any, fullRec: boolean) {

    const entity  = inEntity as any,
          meField = this.meField

    if (newValue === undefined) {
      if (meField.mandatory && fullRec) rc.isWarn() && rc.warn(rc.getName(this), `${this.getId()
        }: Db returned undefined for mandatory field. Ignoring...`)
      return
    }

    // basic data type
    // if (this.basicType) {
    //   if (newValue === null) {
    //     return rc.isWarn() && rc.warn(rc.getName(this), `${this.getId()
    //       }: Db returned null value for base data type. Ignoring...`)
    //   }
    //   if (newValue.constructor !== meField.fieldType) {
    //     rc.isWarn() && rc.warn(rc.getName(this), `${this.getId()}: ${meField.fieldType.name
    //       } came as ${newValue}/${typeof newValue} from db. Converting...`)

    //     if (meField.fieldType === String) newValue = String(newValue)    
    //     else if (meField.fieldType === Boolean) newValue = !!newValue
    //     else { // Number
    //       newValue = Number(newValue)
    //       if (isNaN(newValue)) newValue = 0
    //     }
    //   }
    // // object data type 
    // } else if (newValue !== null && !(
    //             meField.fieldType.prototype.isPrototypeOf(newValue) ||
    //             meField.fieldType.prototype.isPrototypeOf(newValue.constructor.prototype))) {
    //   throw(`${this.getId()}: cannot be set to incompatible type ${
    //     newValue.constructor.name} does not extend ${meField.fieldType.name}`)
    // }
    entity[this.cvFieldName] = newValue
  }

  commitUpsert(inEntity: MudsBaseEntity) {
    const entity = inEntity as any
    if (entity[this.ovFieldName]) entity[this.ovFieldName] = undefined
  }

  $getSubtype() {
    let subtype = 'mult'
    if (this.meField.subtype === Muds.Subtype.embedded) subtype = 'embedded'
    else if (this.meField.subtype === Muds.Subtype.string) subtype = 'string'
    else if (this.meField.subtype === Muds.Subtype.number) subtype = 'number'
    else if (this.meField.subtype === Muds.Subtype.boolean) subtype = 'boolean'
    if (this.meField.isArray) subtype += '[]'
    return subtype
  }

  $printField(inEntity: MudsBaseEntity) {

    const entity = inEntity as any

    let cv = entity[this.cvFieldName],
        ov = entity[this.ovFieldName]

    // let s = `${this.basicType || !cv ? String(cv) : JSON.stringify(cv)}`
    // if (ov && ov.original !== cv) {
    //   ov = ov.original
    //   s += ` (was: ${this.basicType || !ov ? String(ov) : JSON.stringify(ov)})`
    // }
    // return s
  }

}

