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

export class MudsBaseStruct {

  protected entityInfo    : MudsEntityInfo
  constructor(protected rc: RunContextServer, protected manager: MudsManager, 
              recObj ?: Mubble.uObject<any>, fullRec ?: boolean) {
    this.entityInfo  = this.manager.getInfo(this.constructor)

    if (!recObj) return
    const fieldNames  = this.entityInfo.fieldNames
    for (const fieldName of fieldNames) {
      const meField   = this.entityInfo.fieldMap[fieldName],
            accessor  = meField.accessor

      accessor.loadFromDs(this.rc, this, recObj[fieldName], !!fullRec)
    }
  }

  public getLogId(): string {
    return `MudsStruct: ${this.entityInfo.entityName}`
  }

  getInfo() {
    return this.entityInfo
  }

  $dump() {
    console.log(this.toString())
  }

  // overloaded to print even the entity
  public toString(indent = 0) {

    const entityInfo = this.entityInfo,
          thisObj    = this as any,
          aks        = thisObj.ancestorKeys,
          sk         = thisObj.selfKey

    let str = ' '.repeat(indent) + `------ ${entityInfo.entityName} -------\n`

    if (aks && aks.length) {
      const ancestorsInfo = entityInfo.ancestors
      str += this.$rowHead('ancestors', indent)
      for (const [index, info] of ancestorsInfo.entries()) {
        str += this.$key(info, aks[index])
      }
      str += '\n'
    }

    if (sk) {
      str += this.$rowHead('key', indent) + 
      `${this.$key(entityInfo, sk)}\n`
    }

    for (const fieldName of entityInfo.fieldNames) {
      const meField = entityInfo.fieldMap[fieldName],
            headEntry = (meField.mandatory ? '*' : '') + 
                        `${fieldName}/${meField.fieldType.name}` + 
                        (meField.unique ? '+' : (meField.indexed ? '@' : '')) 
                        
      str += this.$rowHead(headEntry, indent) + 
        ` ${meField.accessor.$printField(this, indent)}\n`
    }
    return str
  }

  private $key(info: MudsEntityInfo, key: undefined | string | DatastoreInt) {
    return ` ${info.entityName} (${key ? (info.keyType === Muds.Pk.String ? `"${key}"` : 
      ('Int: ' + (key as DatastoreInt).value)) : key })`
  }

  private $rowHead(str: string, indent: number) {
    return lo.padEnd(' '.repeat(indent + 2) + str, 24) + ' => '
  }

}

export class MudsBaseEntity extends MudsBaseStruct {

  private ancestorKeys  : (string | DatastoreInt) []
  private selfKey       : string | DatastoreInt | undefined

  private savePending   : boolean  // indicates that entity is pending to be saved
  private fromDs        : boolean  // indicates that entity has been restored from ds (get or query)

  constructor(rc: RunContextServer, manager: MudsManager,
              keys: (string | DatastoreInt)[], recObj: Mubble.uObject<any>, 
              fullRec: boolean) {

    super(rc, manager, recObj, fullRec)
    if (recObj) this.fromDs = true // means data has been loaded
    if (keys) {
      const {ancestorKeys, selfKey} = this.manager.separateKeysForInsert(this.rc, 
                                        this.entityInfo.cons, keys)
      this.ancestorKeys = ancestorKeys
      if (selfKey) {
        this.selfKey      = selfKey
      } else {
        rc.isAssert() && rc.assert(rc.getName(this), !recObj, `Cannot have selfkey without data`)
      }
    } else if (this.entityInfo.keyType !== Muds.Pk.Auto || this.entityInfo.ancestors.length) {
      rc.isAssert() && rc.assert(rc.getName(this), this.selfKey, `Cannot create entity without keys`)
    }
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

    const fieldNames  = this.entityInfo.fieldNames

    for (const fieldName of fieldNames) {
      const meField = this.entityInfo.fieldMap[fieldName]
      meField.accessor.resetter(this)
    }
  }

  // Tells whether the entity has been restored from ds during getForUpsert call
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
  getAncestorKey() {
    return this.ancestorKeys
  }

  getSelfKey() {
    return this.selfKey
  }

  // The path may be of multiple undocumented form, handling all of them here
  commitUpsert(path: any) {

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
}

/* ---------------------------------------------------------------------------
  FieldAccessor: Does all field level I/O

  P R I V A T E    C O D E    S E C T I O N     C O N T I N U E S
-----------------------------------------------------------------------------*/
export class FieldAccessor {

  readonly ovFieldName : string // original value field name
  readonly cvFieldName : string // current  value field name
  readonly basicType   : boolean
  readonly isMudStruct : boolean

  constructor(private entityName: string, private fieldName: string, private meField: MeField) {
    this.ovFieldName = '_$$_' + fieldName
    this.cvFieldName  = '_$_' + fieldName
    this.basicType = [Number, String, Boolean].indexOf(meField.fieldType as any) !== -1
    this.isMudStruct = MudsBaseStruct.prototype.isPrototypeOf(meField.fieldType.prototype)
  }

  private getter(inEntity: MudsBaseStruct) {
    return (inEntity as any)[this.cvFieldName]
  }

  private getId() {
    return `${this.entityName}/${this.fieldName}`
  }

  setter(inEntity: MudsBaseStruct, newValue: any) {

    const entity = inEntity as any

    // when there is no change
    if (entity[this.cvFieldName] === newValue) return

    const meField = this.meField
    if (newValue === undefined) {
      if (meField.mandatory) throw(this.getId() + ' Mandatory field cannot be set to undefined')
    } else {
      this.validateType(newValue)
    }
    entity[this.cvFieldName] = newValue
  }

  private getOriginal(inEntity: MudsBaseStruct) {
    const entity = inEntity as any,
          ov     = entity[this.ovFieldName]

    return ov ? ov.original : undefined
  }

  private setOriginal(inEntity: MudsBaseStruct, value: any) {
    const entity = inEntity as any
    entity[this.ovFieldName] = {original: value}
  }

  private hasOriginal(inEntity: MudsBaseStruct) {
    const entity = inEntity as any,
          ov     = entity[this.ovFieldName]

    return !!ov
  }

  validateType(newValue: any) {
    // basic data type
    const meField = this.meField
    if (this.basicType) {
      if (newValue === null) throw(this.getId() + ' Base data types cannot be set to null')
      if (newValue.constructor !== meField.fieldType) {
        throw(`${this.getId()}: ${meField.fieldType.name} field cannot be set to ${newValue}/${typeof newValue}`)
      }
    } else if (meField.fieldType === Array) {
      if (!Array.isArray(newValue)) {
        throw(`${this.getId()}: array cannot be set to non-array type '${newValue.constructor.name}'`)
      }
    } else if (meField.fieldType === Object) {
      // all allowed
    } else if (newValue !== null && !(
                meField.fieldType.prototype.isPrototypeOf(newValue) ||
                meField.fieldType.prototype.isPrototypeOf(newValue.constructor.prototype))) {
      throw(`${this.getId()}: cannot be set to incompatible type '${
        newValue.constructor.name}'. Type does not extend '${meField.fieldType.name}'`)
    }
  }

  resetter(inEntity: MudsBaseStruct) {

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

  setForDs(inEntity: MudsBaseStruct, data: Mubble.uObject<any>) {

    this.checkMandatory(inEntity)

    const entity = inEntity as any

    const value = entity[this.cvFieldName]
    if (value === undefined) return

    data[this.fieldName] = this.setForDsInternal(value)
  }

  private setForDsInternal(value: any): any {

    if (this.basicType || !value || this.meField.fieldType === Object) return value
    if (Array.isArray(value)) return value.map(item => this.setForDsInternal(item))

    if (!(value instanceof MudsBaseStruct)) throw(`${this.getId()
      }: Code bug Invalid type: ${value.constructor.name}`)

    const ee          = value as MudsBaseStruct,
          info        = ee.getInfo(),
          inObj       = {},
          fieldNames  = info.fieldNames

    for (const fieldName of fieldNames) {
      const accessor  = info.fieldMap[fieldName].accessor
      accessor.setForDs(ee, inObj)
    }
    return inObj
  }

  buildExclusions(rc: RunContextServer, inEntity: MudsBaseStruct, arExclude: string[]) {
    const entity = inEntity as any

    const value = entity[this.cvFieldName]
    if (value === undefined) return
    this.buildNestedExclusions(value, '', arExclude)
  }

  private buildNestedExclusions(value: any, prefix: string, arExclude: string[]) {

    if (!(this.meField.indexed || this.meField.unique)) {
      arExclude.push((prefix ? prefix + '.' : '') + this.fieldName)
      return
    }

    if (value instanceof MudsBaseStruct) {

      const embedInfo = value.getInfo()

      for (const cfName of embedInfo.fieldNames) {
        const cAccessor = embedInfo.fieldMap[cfName].accessor,
              cValue    = (value as any)[this.fieldName]
        cAccessor.buildNestedExclusions(cValue, (prefix ? prefix + '.' : '') + this.fieldName, arExclude)
      }
    }
  }

  isModified(inEntity: MudsBaseStruct) {
    return !!(inEntity as any)[this.ovFieldName]
  }

  checkMandatory(inEntity: MudsBaseStruct) {

    if (!this.meField.mandatory) return true
    const entity = inEntity as any
    if(entity[this.cvFieldName] === undefined) throw(`${this.getId()}: mandatory field must not be undefined`)
  }

  // Should be called only once while constructing the object
  loadFromDs(rc: RunContextServer, inEntity: MudsBaseStruct, newValue: any, fullRec: boolean) {

    const entity  = inEntity as any,
          meField = this.meField

    if (newValue === undefined) {
      if (meField.mandatory && fullRec) rc.isWarn() && rc.warn(rc.getName(this), `${this.getId()
        }: Db returned undefined for mandatory field. Ignoring...`)
      return this.setOriginal(inEntity, newValue)
    }

    if (this.basicType) {
      if (newValue === null) {
        rc.isWarn() && rc.warn(rc.getName(this), `${this.getId()
          }: Db returned null value for base data type. Ignoring...`)
        return this.setOriginal(inEntity, undefined)
      }
      if (newValue.constructor !== meField.fieldType) {
        rc.isWarn() && rc.warn(rc.getName(this), `${this.getId()}: ${meField.fieldType.name
          } came as ${newValue}/${typeof newValue} from db. Converting...`)

        if (meField.fieldType === String) newValue = String(newValue)    
        else if (meField.fieldType === Boolean) newValue = !!newValue
        else { // Number
          newValue = Number(newValue)
          if (isNaN(newValue)) newValue = 0
        }
      }
    } else if (meField.fieldType === Array) {
      if (!Array.isArray(newValue)) {
        rc.isWarn() && rc.warn(rc.getName(this), `${this.getId()}: array cannot be set to non-array type '${newValue.constructor.name}'`)
        newValue = []
      }
    } else if (meField.fieldType === Object) {
      // all allowed
    } else if (newValue !== null) {
      const Cls = this.meField.fieldType as Muds.IBaseStruct<MudsBaseStruct>
      newValue = new Cls(rc, entity.manager, newValue, fullRec)
    }
    entity[this.cvFieldName] = newValue
    this.setOriginal(inEntity, newValue)
  }

  commitUpsert(inEntity: MudsBaseStruct) {
    const entity = inEntity as any
    if (entity[this.ovFieldName]) entity[this.ovFieldName] = undefined
  }

  $printField(inEntity: MudsBaseStruct, indent: number) {

    const entity    = inEntity as any

    let cv = entity[this.cvFieldName],
        ov = this.getOriginal(inEntity)

    if (this.isMudStruct) {
      if (cv) cv = this.structToObject(cv)
      if (ov) ov = this.structToObject(ov)
    }    

    let s = `${this.basicType || !cv ? String(cv) : JSON.stringify(cv)}`
    if (this.hasOriginal(entity) && entity[this.cvFieldName] !== this.getOriginal(inEntity)) {
      s += ` (was: ${this.basicType || !ov ? String(ov) : JSON.stringify(ov)})`
    }
    return s
  }

  private structToObject(ee: MudsBaseStruct): any {

    const info        = ee.getInfo(),
          inObj       = {} as Mubble.uObject<any>,
          fieldNames  = info.fieldNames

    for (const fieldName of fieldNames) {
      const accessor  = info.fieldMap[fieldName].accessor,
            value     = (ee as any)[fieldName]

      inObj[fieldName] = value && accessor.isMudStruct ? this.structToObject(value) : value
    }
    return inObj
  }

}

