/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Sun May 20 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import 'reflect-metadata'
import * as Datastore                   from '@google-cloud/datastore'
import * as DsEntity                    from '@google-cloud/datastore/entity'

import { Muds, DatastoreInt, 
         DatastoreKey, DsRec }          from "./muds"
import { MudsBaseEntity, 
         FieldAccessor  }               from "./muds-base-entity"
import { Mubble }                       from '@mubble/core'
import { GcloudEnv }                    from '../../gcp/gcloud-env'
import { RunContextServer }             from '../..'

export class MeField {
  accessor: FieldAccessor
  constructor(readonly fieldName    : string,

              // Basic Type + other custom type can be allowed on need basis
              readonly fieldType    : StringConstructor | 
                                      NumberConstructor | 
                                      BooleanConstructor | 
                                      ObjectConstructor | 
                                      ArrayConstructor, 

              readonly mandatory    : boolean,
              readonly indexed      : boolean,
              readonly unique       : boolean
  ) {
    if (unique && !indexed) throw('Field cannot be unique without being indexed')            
  }
}

export class MudsEntityInfo {
  
  readonly entityName  : string
  readonly ancestors   : MudsEntityInfo[] = []
  readonly fieldMap    : Mubble.uObject<MeField> = {}
  readonly fieldNames  : string[] = []

  constructor(readonly cons        : {new(): MudsBaseEntity},
              readonly version     : number,
              readonly keyType     : Muds.Pk) {
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


  public getInfo(entityClass: Function | {new (): MudsBaseEntity}): MudsEntityInfo {
    return this.entityInfoMap[entityClass.name]
  }


  /* ---------------------------------------------------------------------------
   P R I V A T E    C O D E    S E C T I O N     B E L O W

   D O   N O T   A C C E S S   D I R E C T L Y
  -----------------------------------------------------------------------------*/
  getDatastore() {
    return this.datastore
  }

  registerEntity <T extends Muds.BaseEntity> (version: number, 
                pkType: Muds.Pk, cons: {new(): T}) {

    if (!this.tempAncestorMap) throw(`Trying to register entity ${cons.name
      } after Muds.init(). Forgot to add to entities collection?`)

    const entityName = cons.name  

    const old = this.entityInfoMap[entityName]
    if (old) throw(`Double annotation of entity for ${entityName}?`)
                                
    const info = new MudsEntityInfo(cons, version, pkType)
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

  registerField({mandatory = false, indexed = false, unique = false}, target: any, fieldName: string) {

    const cons          = target.constructor,
          entityName    = cons.name,
          fieldType     = Reflect.getMetadata('design:type', target, fieldName),
          field         = new MeField(fieldName, fieldType, mandatory, indexed, unique)

    if (!this.tempAncestorMap) throw(`Trying to register entity ${entityName
      } after Muds.init(). Forgot to add to entities collection?`)

    if (!fieldType) throw(`Null and undefined type fields are not allowed ${entityName}/${fieldName}`)      
    if (!this.tempEntityFieldsMap) throw('Code bug')

    if (indexed || unique) {
      if ([Number, String].indexOf(fieldType) === -1) throw(`${entityName}/${fieldName
        }: indexed/unique fields cannot be of type '${fieldType.name}'`)
    }

    let efm = this.tempEntityFieldsMap[entityName]
    if (!efm) this.tempEntityFieldsMap[entityName] = efm = {}

    if (efm[fieldName]) throw(`${entityName}/${fieldName}: has been annotated twice?`)
    field.accessor = new FieldAccessor(entityName, fieldName, field)
    efm[fieldName] = Object.freeze(field)
    return field.accessor.getAccessor()
  }

  init(rc : RunContextServer, gcloudEnv : GcloudEnv) {

    if (!this.tempAncestorMap) throw(`Second attempt at Muds.init()?`)

    // All the entities must have been registered before
    let entities = Object.keys(this.tempAncestorMap)
    for (const entityName of entities) {
      const entityInfo = this.entityInfoMap[entityName],
            ancestors  = this.tempAncestorMap[entityName]

      rc.isAssert() && rc.assert(rc.getName(this), entityInfo, 
        `Missing entity annotation on ${entityName}?`)
              
      for (const ancestor of ancestors) {
        const ancestorInfo = this.entityInfoMap[ancestor.name]
        rc.isAssert() && rc.assert(rc.getName(this), ancestorInfo, 
          `Missing entity annotation on ${ancestor.name}?`)
        entityInfo.ancestors.push(ancestorInfo)
      }
    }

    if (!this.tempEntityFieldsMap) throw(`Code bug`)
    entities = Object.keys(this.tempEntityFieldsMap)
    for (const entityName of entities) {
      const entityInfo = this.entityInfoMap[entityName],
            fieldsMap  = this.tempEntityFieldsMap[entityName]

      rc.isAssert() && rc.assert(rc.getName(this), entityInfo, 
        `Missing entity annotation on ${entityName}?`)

      Object.assign(entityInfo.fieldMap, fieldsMap)
      entityInfo.fieldNames.push(...Object.keys(entityInfo.fieldMap))
    }

    this.datastore = new Datastore({
      projectId   : gcloudEnv.projectId,
      credentials : gcloudEnv.authKey || undefined
    })

    rc.isDebug() && rc.debug(rc.getName(this), `Muds initialized with ${
      Object.keys(this.entityInfoMap).length} entities`)

    this.finalizeDataStructures()
  }

  private finalizeDataStructures() {

    this.tempEntityFieldsMap  = null
    this.tempAncestorMap      = null
    this.entityNames          = Object.keys(this.entityInfoMap)

    Object.freeze(this.entityInfoMap)
    Object.freeze(this)
  }

  
  /* ---------------------------------------------------------------------------
     I N T E R N A L   U T I L I T Y    F U N C T I O N S
  -----------------------------------------------------------------------------*/
  prepareKeyForDs<T extends Muds.BaseEntity>(rc: RunContextServer, 
                  entityClass : Muds.IBaseEntity<T>, 
                  keys        : (string | DatastoreInt) []): DatastoreKey {

    const entityInfo    = this.getInfo(entityClass),
          ancestorsInfo = entityInfo.ancestors

    const {ancestorKeys, selfKey} = this.separateKeys(rc, entityInfo, ancestorsInfo, keys)
    return this.buildKey(rc, entityInfo, ancestorKeys, selfKey)
  }

  separateKeys(rc: RunContextServer, entityInfo: MudsEntityInfo, 
               ancestorsInfo: MudsEntityInfo[], keys: (string | DatastoreInt) []) {

    rc.isAssert() && rc.assert(rc.getName(this), keys.length >= ancestorsInfo.length)
    const ancestorKeys = []

    for (const [index, info] of ancestorsInfo.entries()) {
      ancestorKeys.push(this.checkKeyType(rc, keys[index], info))
    }

    let selfKey
    if (keys.length === ancestorsInfo.length) {
      rc.isAssert() && rc.assert(rc.getName(this), entityInfo.keyType !== Muds.Pk.String)
      selfKey = undefined
    } else {
      selfKey = this.checkKeyType(rc, keys[keys.length - 1], entityInfo)
    }

    return {ancestorKeys, selfKey}
  }

  private checkKeyType(rc: RunContextServer, key: DatastoreInt | string, info: MudsEntityInfo) {

    const strKey = info.keyType === Muds.Pk.String ? key : (key as DatastoreInt).value 
    rc.isAssert() && rc.assert(rc.getName(this), strKey && 
      typeof(strKey) === 'string')
    return key
  }

  private buildKey(rc: RunContextServer, entityInfo: MudsEntityInfo, 
                   ancestorKeys: (string | DatastoreInt) [], 
                   selfKey: string | DatastoreInt | undefined) {

    const keyPath: (string | DatastoreInt)[] = []

    for (const [index, ancestor] of entityInfo.ancestors.entries()) {
      keyPath.push(ancestor.entityName, ancestorKeys[index])
    }

    keyPath.push(entityInfo.entityName)
    if (selfKey !== undefined) keyPath.push(selfKey)
    return this.datastore.key(keyPath)
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
            key                 : this.buildKey(rc, entityInfo, ancestorKeys, selfKey),
            data                : {},
            excludeFromIndexes  : []
          }

    for (const fieldName of fieldNames) {
      const accessor  = entity.getInfo().fieldMap[fieldName].accessor
      accessor.setForDs(rc, entity, dsRec)
    }
    return dsRec
  }

  
}