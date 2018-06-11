/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Sun May 20 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import 'reflect-metadata'
import * as Datastore                   from '@google-cloud/datastore'
import * as DsEntity                    from '@google-cloud/datastore/entity'

import {  Muds, 
          DatastoreInt, 
          DatastoreKey, 
          DsRec, 
          EntityType }                  from "./muds"
import { MudsBaseEntity, 
         FieldAccessor  }               from "./muds-base-entity"
import { Mubble }                       from '@mubble/core'
import { GcloudEnv }                    from '../../gcp/gcloud-env'
import { RunContextServer }             from '../..'

export class MeField {
  accessor: FieldAccessor
  constructor(readonly fieldName    : string,

              // Subtype of field when it is not possible to decipher it from reflection
              readonly subtype      : Muds.Subtype,

              readonly isMulti      : boolean,
              readonly isArray      : boolean,

              readonly mandatory    : boolean,
              readonly indexed      : boolean,
              readonly unique       : boolean
  ) {
    if (unique && !indexed) throw('Field cannot be unique without being indexed')            
  }

  isTypeEmbedded() {
    return !!(this.subtype & Muds.Subtype.embedded)
  }
}

export class MudsEntityInfo {
  
  readonly entityName       : string
  readonly ancestors        : MudsEntityInfo[] = []
  readonly fieldMap         : Mubble.uObject<MeField> = {}
  readonly fieldNames       : string[] = []
  readonly compositeIndices : Mubble.uObject<Muds.Asc | Muds.Dsc>[] = []

  constructor(readonly cons        : {new(): MudsBaseEntity},
              readonly version     : number,
              readonly keyType     : Muds.Pk,
              readonly entityType  : EntityType) {
    this.entityName = cons.name        
  }
}

export type DatastorePayload = {
  key                 : DsEntity.DatastoreKey
  data                : DsRec
  excludeFromIndexes  : string[]
}

export class MudsManager {

  private entityInfoMap       : Mubble.uObject<MudsEntityInfo> = {}
  private datastore           : Datastore
  private entityNames         : string[]

  // Temporary members while store schema is built
  private tempAncestorMap     : Mubble.uObject<{new(): Muds.BaseEntity}[]> | null = {}
  private tempEntityFieldsMap : Mubble.uObject<Mubble.uObject<MeField>> | null = {}
  private tempCompIndices     : Mubble.uObject<Mubble.uObject<Muds.Asc | Muds.Dsc>[]> | null = {}

  public getInfo(entityClass: Function | {new (): MudsBaseEntity} | string): MudsEntityInfo {

    const entityName = typeof entityClass === 'string' ? entityClass : entityClass.name
    return this.entityInfoMap[entityName]
  }


  /* ---------------------------------------------------------------------------
   P R I V A T E    C O D E    S E C T I O N     B E L O W

   D O   N O T   A C C E S S   D I R E C T L Y
  -----------------------------------------------------------------------------*/
  getDatastore() {
    return this.datastore
  }

  registerEntity <T extends Muds.BaseEntity> (version: number, 
                pkType: Muds.Pk, entityType: EntityType, cons: {new(): T}) {

    if (!this.tempAncestorMap) throw(`Trying to register entity ${cons.name
      } after Muds.init(). Forgot to add to entities collection?`)

    const entityName = cons.name  

    const old = this.entityInfoMap[entityName]
    if (old) throw(`Double annotation of entity for ${entityName}?`)
                                
    const info = new MudsEntityInfo(cons, version, pkType, entityType)
    this.entityInfoMap[info.entityName] = info
  }

  registerAncestors <T extends Muds.BaseEntity> (ancestors: {new(): Muds.BaseEntity}[], 
                    cons: {new(): T}) {

    if (!this.tempAncestorMap) throw(`Trying to register entity ${cons.name
      } after Muds.init(). Forgot to add to entities collection?`)

    const info = this.tempAncestorMap[cons.name]
    if (info) throw(`Double annotation of ancestors for ${cons.name}?`)

    Object.freeze(ancestors)
    this.tempAncestorMap[cons.name] = ancestors
  }

  registerCompositeIndex <T extends Muds.BaseEntity> (idxObj: Mubble.uObject<Muds.Asc | Muds.Dsc>, 
                    cons: {new(): T}) {

    if (!this.tempCompIndices) throw(`Trying to register entity ${cons.name
      } after Muds.init(). Forgot to add to entities collection?`)

    if (!this.tempCompIndices[cons.name]) this.tempCompIndices[cons.name] = []

    const ci = this.tempCompIndices[cons.name]
    ci.push(idxObj)
    console.log(idxObj)
    Object.freeze(idxObj)
  }

  registerField({mandatory = false, subtype = Muds.Subtype.auto, indexed = false, unique = false}, target: any, fieldName: string) {

    const cons          = target.constructor,
          entityName    = cons.name

    let   fieldType     = Reflect.getMetadata('design:type', target, fieldName)

    if (!this.tempAncestorMap) throw(`Trying to register entity ${entityName
      } after Muds.init(). Forgot to add to entities collection?`)

    if (!fieldType) throw(`Null and undefined type fields are not allowed ${entityName}/${fieldName}`)

    if ((fieldType === Object || fieldType === Array) && subtype === Muds.Subtype.auto) {
      throw(`${entityName}/${fieldName} of type ${fieldType}, cannot decipher subtype. Please provide`)
    }

    if (fieldType === Number) {
      if (!(subtype === Muds.Subtype.number || subtype === Muds.Subtype.auto)) {
        throw(`For ${entityName}/${fieldName} of type: ${fieldType}, subtype ${
          subtype} is invalid`)
      }
      subtype = Muds.Subtype.number
    }

    let targetSubtype: Muds.Subtype = 0
    
    if (fieldType === Number)   targetSubtype = Muds.Subtype.number
    else if (fieldType === String)   targetSubtype = Muds.Subtype.string
    else if (fieldType === Boolean)  targetSubtype = Muds.Subtype.boolean
    else if (Muds.BaseEntity.isPrototypeOf(fieldType.prototype)) {
      targetSubtype = Muds.Subtype.embedded
      fieldType = Object
    }

    if (targetSubtype) {
      if (subtype === Muds.Subtype.auto) {
        subtype = targetSubtype
      } else if (subtype !== targetSubtype) {
        throw(`For ${entityName}/${fieldName} of type: ${fieldType}, subtype ${
          subtype} is invalid`)
      }
    } else {
      if (subtype === Muds.Subtype.auto) {
        throw(`For ${entityName}/${fieldName} of type: ${fieldType}, it is mandatory to give subtype. 
          We cannot decipher it automatically`)
      }

      this.isValidSubtype(`${entityName}/${fieldName}`, subtype)
    }

    if (!this.tempEntityFieldsMap) throw('Code bug')
    let efm = this.tempEntityFieldsMap[entityName]
    if (!efm) this.tempEntityFieldsMap[entityName] = efm = {}
    if (efm[fieldName]) throw(`${entityName}/${fieldName}: has been annotated twice?`)

    const field = new MeField(fieldName, subtype, fieldType === Object, 
                    fieldType === Array, mandatory, indexed, unique)

    field.accessor = new FieldAccessor(entityName, fieldName, field)
    efm[fieldName] = Object.freeze(field)
    return field.accessor.getAccessor()
  }

  private isValidSubtype(logStr: string, subType: Muds.Subtype) {

    const isEmbedded = subType & Muds.Subtype.embedded,
          isBasic    = subType & (Muds.Subtype.boolean | Muds.Subtype.number | Muds.Subtype.string)

    if (isEmbedded ^ isBasic) throw(`${logStr}: Invalid subtype: ${subType
      } subtype should either be embedded or basic`)
  }

  init(rc : RunContextServer, gcloudEnv : GcloudEnv) {

    if (this.entityNames || 
        !this.tempAncestorMap ||
        !this.tempEntityFieldsMap ||
        !this.tempCompIndices) throw(`Second attempt at Muds.init()?`)

    this.entityNames = Object.keys(this.entityInfoMap)

    for (const entityName of this.entityNames) {

      const ancestors   = this.extractFromMap(this.tempAncestorMap, entityName),
            fieldsMap   = this.extractFromMap(this.tempEntityFieldsMap, entityName),
            compIndices = this.extractFromMap(this.tempCompIndices, entityName),
            entityInfo  = this.entityInfoMap[entityName]

      if (ancestors || fieldsMap || compIndices) rc.isAssert() && rc.assert(rc.getName(this), 
        entityInfo.entityType !== EntityType.Dummy,  `dummy cannot have any other annotation ${entityName}?`)

        entityInfo.entityType !== EntityType.Dummy && rc.isAssert() && rc.assert(rc.getName(this), fieldsMap, 
        `no fields found for ${entityName}?`)

      if (ancestors) this.valAndProvisionAncestors(rc, ancestors, entityInfo)

      Object.assign(entityInfo.fieldMap, fieldsMap)
      entityInfo.fieldNames.push(...Object.keys(entityInfo.fieldMap))

      if (compIndices) this.valAndProvisionCompIndices(rc, compIndices, entityInfo)
    }

    this.datastore = new Datastore({
      projectId   : gcloudEnv.projectId,
      credentials : gcloudEnv.authKey || undefined
    })

    rc.isDebug() && rc.debug(rc.getName(this), `Muds initialized with ${
      Object.keys(this.entityInfoMap).length} entities`)

    this.finalizeDataStructures(rc)
  }

  private extractFromMap(obj: Mubble.uObject<any>, prop: string) {
    const val = obj[prop]
    delete obj[prop]
    return val
  }

  private valAndProvisionAncestors( rc : RunContextServer, 
                                    ancestors: {new(): Muds.BaseEntity}[], 
                                    entityInfo: MudsEntityInfo) {

    for (const ancestor of ancestors) {
      const ancestorInfo = this.entityInfoMap[ancestor.name]
      rc.isAssert() && rc.assert(rc.getName(this), ancestorInfo, 
        `Missing entity annotation on ${ancestor.name}?`)

      rc.isAssert() && rc.assert(rc.getName(this), ancestorInfo.entityType !== EntityType.Embedded, 
        `${entityInfo.entityName}: Cannot have Embedded entity ${ancestor.name} as ancestor?`)
        
      entityInfo.ancestors.push(ancestorInfo)
    }
  }

  private valAndProvisionCompIndices( rc : RunContextServer, 
                                      compIndices: Mubble.uObject<Muds.Asc | Muds.Dsc>[], 
                                      entityInfo: MudsEntityInfo) {

    for (const compIdx of compIndices) {
      const fields = Object.keys(compIdx)
      for (const field of fields) {
        const me = entityInfo.fieldMap[field]
        rc.isAssert() && rc.assert(rc.getName(this), me && me.indexed,
          `Invalid field or field not indexed ${entityInfo.entityName}/${field}`)
      }
      entityInfo.compositeIndices.push(compIdx)
    }
    Object.freeze(entityInfo.compositeIndices)
  }

  private finalizeDataStructures(rc: RunContextServer) {

    this.dealloc(rc, 'tempEntityFieldsMap')
    this.dealloc(rc, 'tempAncestorMap')
    this.dealloc(rc, 'tempCompIndices')

    Object.freeze(this.entityInfoMap)
    Object.freeze(this)
  }

  private dealloc(rc    : RunContextServer, 
                  elem  : 'tempEntityFieldsMap' | 'tempAncestorMap' | 'tempCompIndices') {

    const obj   = this[elem],
          keys  = Object.keys(obj as any)

    rc.isAssert() && rc.assert(rc.getName(this), !keys.length,
      ` ${elem} is not empty. Has: ${keys}`)

    this[elem] = null  
  }

  
  
  /* ---------------------------------------------------------------------------
     I N T E R N A L   U T I L I T Y    F U N C T I O N S
  -----------------------------------------------------------------------------*/
  separateKeys<T extends Muds.BaseEntity>(rc: RunContextServer, 
    entityClass : Muds.IBaseEntity<T>, 
    keys        : (string | DatastoreInt) []) {

    const {ancestorKeys, selfKey} = this.separateKeysForInsert(rc, entityClass, keys)
    if (selfKey === undefined) {
      throw('Self key is not set')
    } else {
      return {ancestorKeys, selfKey}
    }
  }

  separateKeysForInsert<T extends Muds.BaseEntity>(rc: RunContextServer, 
                  entityClass : Muds.IBaseEntity<T>, 
                  keys        : (string | DatastoreInt) []) {

    const entityInfo    = this.getInfo(entityClass),
          ancestorsInfo = entityInfo.ancestors

    rc.isAssert() && rc.assert(rc.getName(this), keys.length >= ancestorsInfo.length)
    const ancestorKeys = []

    for (const [index, info] of ancestorsInfo.entries()) {
      ancestorKeys.push(this.checkKeyType(rc, keys[index], info))
    }

    let selfKey
    if (keys.length === ancestorsInfo.length) {
      rc.isAssert() && rc.assert(rc.getName(this), 
        entityInfo.keyType === Muds.Pk.None || entityInfo.keyType === Muds.Pk.Auto)
      selfKey = undefined
    } else {
      selfKey = this.checkKeyType(rc, keys[keys.length - 1], entityInfo)
    }

    Object.freeze(ancestorKeys)
    return {ancestorKeys, selfKey}
  }

  private checkKeyType(rc: RunContextServer, key: DatastoreInt | string, info: MudsEntityInfo) {

    const strKey = info.keyType === Muds.Pk.String ? key : (key as DatastoreInt).value 
    rc.isAssert() && rc.assert(rc.getName(this), strKey && 
      typeof(strKey) === 'string')
    return key
  }

  buildKey<T extends Muds.BaseEntity>(rc: RunContextServer, 
                                      entityClass : Muds.IBaseEntity<T>, 
                                      ancestorKeys: (string | DatastoreInt) [], 
                                      selfKey: string | DatastoreInt | undefined) {

    const keyPath: (string | DatastoreInt)[] = [],
          entityInfo = this.getInfo(entityClass)

    for (const [index, ancestor] of entityInfo.ancestors.entries()) {
      keyPath.push(ancestor.entityName, ancestorKeys[index])
    }

    keyPath.push(entityInfo.entityName)
    if (selfKey !== undefined) keyPath.push(selfKey)

    // console.log(`keyPath ${JSON.stringify(keyPath)}`)
    return this.datastore.key(keyPath)
  }

  extractKeyFromDs<T extends Muds.BaseEntity>(rc: RunContextServer, 
                  entityClass : Muds.IBaseEntity<T>, 
                  rec         : Mubble.uObject<any>) : (string | DatastoreInt)[] {

    const entityInfo    = this.getInfo(entityClass),
          ancestorsInfo = entityInfo.ancestors,
          arKey         = [] as (string | DatastoreInt)[],
          key           = rec[this.datastore.KEY] as DatastoreKey,
          keyPath       = key.path

    rc.isAssert() && rc.assert(rc.getName(this), 
      key.kind === entityInfo.entityName)
    rc.isAssert() && rc.assert(rc.getName(this), 
      entityInfo.keyType === Muds.Pk.String ? key.name : key.id)
    rc.isAssert() && rc.assert(rc.getName(this), 
      ancestorsInfo.length === (keyPath.length / 2) - 1)

    for (let index = 0; index < keyPath.length - 2; index = index + 2) {
      const kind = keyPath[index],
            subk = keyPath[index + 1],
            anc  = ancestorsInfo[index / 2]

      rc.isAssert() && rc.assert(rc.getName(this), 
          kind === anc.entityName)
      if (anc.keyType === Muds.Pk.String) {
        rc.isAssert() && rc.assert(rc.getName(this), typeof(subk) === 'string')
        arKey.push(subk as string)
      } else if (typeof(subk) === 'string') {
        arKey.push(Muds.getIntKey(subk))
      } else {
        rc.isAssert() && rc.assert(rc.getName(this), typeof(subk) === 'object' && subk.value)
        arKey.push(subk as DatastoreInt)
      }
    }
    arKey.push(entityInfo.keyType === Muds.Pk.String ? key.name as string : 
      Muds.getIntKey(key.id as string))
    return arKey
  }

  getRecordFromDs<T extends Muds.BaseEntity>(rc: RunContextServer, 
                    entityClass : Muds.IBaseEntity<T>, 
                    record: Mubble.uObject<any>): T {

    const keys = this.extractKeyFromDs(rc, entityClass, record)
    return new entityClass(rc, this, keys, record)
  }

  getRecordForUpsert(rc: RunContextServer, entity: MudsBaseEntity) {

    const entityInfo    = entity.getInfo(),
          ancestorKeys  = entity.getAncestorKey(), 
          selfKey       = entity.getSelfKey(),
          ancCount      = entityInfo.ancestors.length

    // Entity does not allow wrong types to be inserted      
    rc.isAssert() && rc.assert(rc.getName(this), ancCount ? ancCount === ancestorKeys.length : 
          !ancestorKeys || ancestorKeys.length === 0)

    const fieldNames : string[]         = entityInfo.fieldNames,
          dsRec      : DatastorePayload = {
            key                 : this.buildKey(rc, entityInfo.cons, ancestorKeys, selfKey),
            data                : {},
            excludeFromIndexes  : []
          }

    for (const fieldName of fieldNames) {
      const accessor  = entity.getInfo().fieldMap[fieldName].accessor
      accessor.setForDs(rc, entity, dsRec)
    }
    return dsRec
  }

  verifyAncestorKeys<T extends Muds.BaseEntity>(rc: RunContextServer, 
                      entityClass : Muds.IBaseEntity<T>, 
                      ancestorKeys: (string | DatastoreInt) []) {

    const entityInfo    = this.getInfo(entityClass),
          ancestorsInfo = entityInfo.ancestors,
          dsKeys        = []

    rc.isAssert() && rc.assert(rc.getName(this), ancestorsInfo.length, 
      'It is mandatory to have ancestorKeys for querying with-in transaction')

    for (const [index, info] of ancestorsInfo.entries()) {
      dsKeys.push(info.entityName, this.checkKeyType(rc, ancestorKeys[index], info))
    }

    return this.datastore.key(dsKeys)
  }
}