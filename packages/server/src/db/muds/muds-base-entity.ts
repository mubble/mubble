/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Wed May 16 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {  
          MeField,
          MudsEntityInfo
       }                                from './muds-manager'
import {  
          Muds,
          DatastoreInt,
          DsRec
       }                                from '..'
import {  MudsIo }                      from './muds-io'
import {  MudsUtil }                    from './muds-util'
import {  RunContextServer  }           from '../../rc-server'
import {  Mubble }                      from '@mubble/core'
import * as DsEntity                    from '@google-cloud/datastore/entity'
import * as lo                          from 'lodash'

export type IMudsCacheEntity<T extends MudsBaseStruct> = T 

/*------------------------------------------------------------------------------
    MudsBaseStruct
------------------------------------------------------------------------------*/
export class MudsBaseStruct {

  protected entityInfo    : MudsEntityInfo
  constructor(protected rc: RunContextServer, protected io: MudsIo, 
              recObj ?: Mubble.uObject<any>, fullRec ?: boolean) {

    this.entityInfo  = this.io.getInfo(this.constructor)

    const fieldNames  = this.entityInfo.fieldNames
    for (const fieldName of fieldNames) {

      const meField   = this.entityInfo.fieldMap[fieldName],
            accessor  = meField.accessor,
            Cls       = MudsUtil.getStructClass(meField)

      let dsValue   = recObj ? recObj[fieldName] : undefined, newValue = dsValue
      if (dsValue && Cls) {
        if (meField.fieldType === Array) {
          if (Array.isArray(dsValue)) {
            newValue = dsValue.map(struct => new Cls(rc, io, struct, fullRec))
          } else {
            rc.isWarn() && rc.warn(rc.getName(this), 
              `${this.getLogId()}: array cannot be set to non-array type '${dsValue.constructor.name}'`)
            newValue = dsValue = undefined
          }
        } else {
          newValue = new Cls(rc, io, dsValue, fullRec)
        }
      }
      accessor.init(this.rc, this, newValue, dsValue, !!fullRec)
    }
  }

  public getLogId(): string {
    return `MudsStruct: ${this.entityInfo.entityName}`
  }

  getInfo() {
    return this.entityInfo
  }

  protected checkMandatory(rc: RunContextServer) {

    const entityInfo = this.entityInfo,
          thisObj    = this as any

    for (const fieldName of entityInfo.fieldNames) {

      const meField = entityInfo.fieldMap[fieldName]
      let value = thisObj[fieldName]
      
      if (value) {
        const Cls = MudsUtil.getStructClass(meField)
        if (Cls) {
          value = meField.fieldType === Array ? value : [value]
          value.forEach((struct: MudsBaseStruct) => struct.checkMandatory(rc))
        }
      } else if (value === undefined) {
        rc.isAssert() && rc.assert(rc.getName(this), !meField.mandatory,
        `${this.getLogId()} ${fieldName} is mandatory`)
      }
    }
  }

  // Arrays can be edited outside of Muds control
  protected RecheckArrays(rc: RunContextServer) {

    const entityInfo = this.entityInfo,
          thisObj    = this as any

    for (const fieldName of entityInfo.fieldNames) {
      const meField  = entityInfo.fieldMap[fieldName],
            value    = thisObj[fieldName]
            
      if (meField.fieldType === Array && value) meField.accessor.validateType(value)
    }
  }

  serialize() {

    const entityInfo = this.entityInfo,
          thisObj    = this as any,
          data       = {} as Mubble.uObject<any>

    for (const fieldName of entityInfo.fieldNames) {
      const meField = entityInfo.fieldMap[fieldName],
            value   = thisObj[fieldName]
      
      if (value === undefined) continue
      data[fieldName] = meField.accessor.serialize(this)
    }

    return data
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
    return lo.padEnd(' '.repeat(indent + 2) + str, 30 + indent) + ' => '
  }
}

export type DatastorePayload = {
  key                 : DsEntity.DatastoreKey
  data                : DsRec
  excludeFromIndexes  : string[]
}

/*------------------------------------------------------------------------------
    MudsBaseEntity
------------------------------------------------------------------------------*/
export class MudsBaseEntity extends MudsBaseStruct {

  private savePending : boolean  // indicates that entity is pending to be saved
  public _id          : string   // Used only while serialising

  constructor(rc                    : RunContextServer, 
              io                    : MudsIo, 
              private ancestorKeys  : (string | DatastoreInt)[],
              private selfKey      ?: (string | DatastoreInt), 
              recObj               ?: Mubble.uObject<any>, 
              fullRec              ?: boolean) {

    super(rc, io, recObj, fullRec)
    if (recObj) {
      rc.isAssert() && rc.assert(rc.getName(this), this.selfKey, `cannot have rec without keys`)
    } else if (this.entityInfo.keyType !== Muds.Pk.Auto) {
      rc.isAssert() && rc.assert(rc.getName(this), this.selfKey, `Cannot create entity without selfkey`)
    }
  }

  public serializeToJson<T extends MudsBaseStruct>() {

    const entityInfo = this.entityInfo,
          thisObj    = this as any,
          data       = {} as Mubble.uObject<any>

    data._id = this.getStringKey(this.getSelfKey())

    for (const fieldName of entityInfo.fieldNames) {
      const meField  = entityInfo.fieldMap[fieldName],
            value    = thisObj[fieldName]
      
      if (value === undefined) continue
      data[fieldName] = meField.accessor.serialize(this)
    }
    return data as T
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

  // Tells whether the entity has been restored from ds during getForUpsert call
  public hasData() {
    const fieldNames = this.entityInfo.fieldNames,
          thisObj    = this as any
    for (const fieldName of fieldNames) {
      if (thisObj[fieldName]) return true
    }
    return false
  }

  // Has been queued up for saving. Another edit would not be permitted on this
  public isSavePending() {
    return this.savePending
  }

  public getLogId(): string {

    const name   = this.entityInfo.entityName,
          ansKey = this.ancestorKeys.map(val => (val as any).value || val),
          self   = this.selfKey ? ((this.selfKey as any).value || this.selfKey) : '[none]'

    return `${name}:${ansKey}/${self}`
  }

  public getFullKey(): (string | DatastoreInt) [] {
    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), this.ancestorKeys && this.selfKey)
    const ar = this.ancestorKeys.map(item => item)
    ar.push(this.selfKey as any)
    return ar
  }

  public getAncestorKey() {
    return this.ancestorKeys
  }

  public getSelfKey() {
    return this.selfKey
  }

  public getStringKey(key : DatastoreInt | string | undefined = this.selfKey) {

    if(!key) return

    if(typeof key === 'string') return key
    else return key.value
  }

  /* ---------------------------------------------------------------------------
   P R I V A T E    C O D E    S E C T I O N     B E L O W

   D O   N O T   A C C E S S   D I R E C T L Y
  -----------------------------------------------------------------------------*/
  convertForUpsert(rc: RunContextServer) {

    const entityInfo = this.entityInfo

    // Entity does not allow wrong types to be inserted      
    rc.isAssert() && rc.assert(rc.getName(this), 
      entityInfo.ancestors.length === this.ancestorKeys.length)

    const dsRec : DatastorePayload = {
            key                : this.io.buildKeyForDs(rc, entityInfo.cons, 
                                    this.ancestorKeys, this.selfKey),
            data               : {},
            excludeFromIndexes : []
          }

    this.checkMandatory(rc)
    this.RecheckArrays(rc)
    
    dsRec.data = this.serialize()
    for (const fieldName of entityInfo.fieldNames) {
      const accessor = this.entityInfo.fieldMap[fieldName].accessor

      accessor.buildExclusions(rc, this, dsRec.excludeFromIndexes)
    }

    console.log('convertForUpsert: data', dsRec.data)
    console.log('convertForUpsert: excludeFromIndexes', dsRec.excludeFromIndexes)

    return dsRec
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

  constructor(private entityName: string, private fieldName: string, private meField: MeField) {
    this.ovFieldName = '_$$_' + fieldName
    this.cvFieldName  = '_$_' + fieldName
    this.basicType = [Number, String, Boolean].indexOf(meField.fieldType as any) !== -1
  }

  // called by manager while registering the schema
  getAccessor() {
    const accessor = this
    return {
      get     : function() { return accessor.getter(this) },
      set     : function(value: any) { accessor.setter(this, value) }
    }
  }

  getter(inEntity: MudsBaseStruct) {
    return (inEntity as any)[this.cvFieldName]
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

/* ---------------------------------------------------------------------------
  P R I V A T E    C O D E  
-----------------------------------------------------------------------------*/
  private getId() {
    return `${this.entityName}/${this.fieldName}`
  }

  private getOriginal(inEntity: MudsBaseStruct) {
    return (inEntity as any)[this.ovFieldName].original
  }

  private setOriginal(inEntity: MudsBaseStruct, value: any) {
    const entity = inEntity as any
    // JSON.stringify converts everything to string except undefined is left as is
    // string is quoted. We are stringifying it so that modification of value does not
    // affect the old value
    entity[this.ovFieldName] = {original: JSON.stringify(value)}
  }

  validateType(newValue: any) {

    const meField = this.meField
    if (meField.fieldType === Object) return  // all allowed
    if (newValue === null) {
      if (MudsUtil.getStructClass(meField)) return // null is allowed for MudsStructs
      throw(`${this.getId()}: null is not allowed`)      
    }

    if (meField.fieldType === Array) {
      if (!Array.isArray(newValue)) throw(`${this.getId()}: '${newValue.constructor.name}' is not array`)
      newValue.forEach(val => this.validateInternal(val, meField.typeHint))
    } else {
      this.validateInternal(newValue, meField.fieldType)
    }
  }

  validateInternal(value: any, fieldType: any) {
    if (value.constructor !== fieldType) {
      throw(`${this.getId()}: ${fieldType.name} field cannot be set to ${value}/${typeof value}`)
    }
  }

  serialize(inEntity: MudsBaseStruct) {
    const entity  = inEntity as any,
          meField = this.meField,
          Cls     = MudsUtil.getStructClass(meField),
          value   = entity[this.fieldName]

    if (!Cls || !value) return value

    if (meField.fieldType === Array) {
      return (value as MudsBaseStruct[]).map(struct => struct.serialize())
    }
    return (value as MudsBaseStruct).serialize()
  }

  buildExclusions(rc: RunContextServer, inEntity: MudsBaseStruct, arExclude: string[]) {
    const entity = inEntity as any

    const value = entity[this.cvFieldName]
    if (value === undefined) return
    this.buildNestedExclusions(value, '', arExclude)
  }

  private buildNestedExclusions(value: any, prefix: string, arExclude: string[]) {

    if (!this.meField.indexed) {
      arExclude.push((prefix ? prefix + '.' : '') + this.fieldName + 
                     (this.meField.fieldType === Array ? '[]' : ''))
      return
    }

    if (lo.isEmpty(value) || !MudsUtil.getStructClass(this.meField)) return // null, [] are all empty

    value = Array.isArray(value) ? value[0] : value
    const info = value.getInfo()

    for (const cfName of info.fieldNames) {
      const accessor = info.fieldMap[cfName].accessor,
            cValue   = (value as any)[this.fieldName]

      accessor.buildNestedExclusions(cValue, 
                  (prefix ? prefix + '.' : '') + this.fieldName + 
                    (this.meField.fieldType === Array ? '[]' : ''), 
                  arExclude)
    }
  }

  isModified(inEntity: MudsBaseStruct) {
    
    const entity  = inEntity as any,
          ov      = this.getOriginal(inEntity)

    let value     = entity[this.fieldName]

    if (value && MudsUtil.getStructClass(this.meField)) {
      value = this.meField.fieldType === Array ? 
                value.map((x: MudsBaseStruct) => x.serialize()) : 
                value.serialize()
    }
    return JSON.stringify(value) !== ov
  }

  // Should be called only once while constructing the object
  init(rc: RunContextServer, inEntity: MudsBaseStruct, newValue: any, dsValue: any, fullRec: boolean) {

    const entity  = inEntity as any,
          meField = this.meField

    if (newValue === dsValue) { // it has not been converted

      if (newValue === undefined) {
        if (meField.mandatory && fullRec) rc.isWarn() && rc.warn(rc.getName(this), `${this.getId()
          }: Db returned undefined for mandatory field. Ignoring...`)
        return this.setOriginal(inEntity, undefined)
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
        dsValue = newValue

      } else if (meField.fieldType === Array) {
        if (!Array.isArray(newValue)) {
          rc.isWarn() && rc.warn(rc.getName(this), `${this.getId()
            }: array cannot be set to non-array type '${newValue.constructor.name}'`)
          newValue = dsValue = undefined
        } else {
          dsValue = newValue = newValue.map(item => 
            this.meField.typeHint === String ? String(item) : Number(item))
        }
      }
    }
    entity[this.cvFieldName] = newValue
    this.setOriginal(inEntity, dsValue)
  }

  commitUpsert(inEntity: MudsBaseStruct) {
    this.setOriginal(inEntity, this.serialize(inEntity))
  }

  $printField(inEntity: MudsBaseStruct, indent = 0) {

    const entity  = inEntity as any,
          ov      = this.getOriginal(inEntity)

    let value     = entity[this.fieldName], s = ''
    if (value && MudsUtil.getStructClass(this.meField)) {
      value = this.meField.fieldType === Array ? value : [value]
      value.forEach((struct: MudsBaseStruct) => {
        s += '\n' + struct.toString(indent + 2)
      })
    } else {
      s = JSON.stringify(value)
      if (s !== ov) s += ` (was: ${ov})`
    }
    return s
  }
}

