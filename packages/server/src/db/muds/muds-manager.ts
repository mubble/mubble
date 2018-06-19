/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Sun May 20 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import 'reflect-metadata'
import * as Datastore                   from '@google-cloud/datastore'
import * as lo                          from 'lodash'

import {  Muds, 
          FieldType,
          ArrayField,
          EntityType }                  from "./muds"
import {  MudsBaseEntity, 
          MudsBaseStruct, 
          FieldAccessor  }              from "./muds-base-entity"
import {  Mubble }                      from '@mubble/core'
import {  GcloudEnv }                   from '../../gcp/gcloud-env'
import {  RunContextServer }            from '../..'
import { MudsUtil } from './muds-util';

export class MeField {
  accessor: FieldAccessor
  constructor(readonly fieldName    : string,
              readonly fieldType    : FieldType,
              readonly typeHint     : ArrayField | undefined, 
              readonly mandatory    : boolean,
              readonly indexed      : boolean,
              readonly unique       : boolean
  ) {
    if (unique && !indexed) throw('Field cannot be unique without being indexed')            
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

export class MudsManager {

  private entityInfoMap       : Mubble.uObject<MudsEntityInfo> = {}
  private datastore           : Datastore
  private entityNames         : string[]

  // Temporary members while store schema is built, they are removed after init
  private tempAncestorMap     : Mubble.uObject<ReadonlyArray<{new(): Muds.BaseEntity}>> = {}
  private tempEntityFieldsMap : Mubble.uObject<Mubble.uObject<MeField>> = {}
  private tempCompIndices     : Mubble.uObject<Mubble.uObject<Muds.Asc | Muds.Dsc>[]> = {}

  /* ---------------------------------------------------------------------------
   P R I V A T E    C O D E    S E C T I O N     B E L O W

   D O   N O T   A C C E S S   D I R E C T L Y
  -----------------------------------------------------------------------------*/
  getDatastore() {
    return this.datastore
  }

  getInfo(entityClass:  Function                         |
                        Muds.IBaseStruct<MudsBaseStruct> | 
                        Muds.IBaseEntity<MudsBaseEntity> | 
                        string): MudsEntityInfo {

    const entityName = typeof entityClass === 'string' ? entityClass : entityClass.name
    return this.entityInfoMap[entityName]
  }

  getInfoMap() {
    return this.entityInfoMap
  }

  registerEntity <T extends Muds.BaseEntity> (version: number, 
                pkType: Muds.Pk, entityType: EntityType, cons: {new(): T}) {

    this.checkInitStatus('registerEntity')

    const entityName = cons.name
    if (this.entityInfoMap[entityName]) throw(`Double annotation of entity for ${entityName}?`)
    this.entityInfoMap[entityName] = new MudsEntityInfo(cons, version, pkType, entityType)
  }

  registerAncestors <T extends Muds.BaseEntity> (ancestors: {new(): Muds.BaseEntity}[], 
                    cons: {new(): T}) {

    this.checkInitStatus('registerAncestors')

    const entityName = cons.name
    if (this.tempAncestorMap[entityName]) throw(`Double annotation of ancestors for ${entityName}?`)
    this.tempAncestorMap[entityName] = Object.freeze(ancestors)
  }

  registerCompositeIndex <T extends Muds.BaseEntity> (idxObj: Mubble.uObject<Muds.Asc | Muds.Dsc>, 
                    cons: {new(): T}) {

    this.checkInitStatus('registerCompositeIndex')

    const entityName = cons.name,
          strIdx     = JSON.stringify(idxObj),
          arCompIdx  = this.tempCompIndices[entityName] || (this.tempCompIndices[cons.name] = [])

    if (arCompIdx.find(item => JSON.stringify(item) === strIdx)) {
      throw(`Double annotation of composite index ${strIdx} for ${entityName}?`)
    }
    arCompIdx.push(Object.freeze(idxObj))
  }

  registerField({mandatory = false, typeHint = undefined, indexed = false, 
      unique = false}, target: any, fieldName: string) {

    this.checkInitStatus('registerField')

    const entityName  = target.constructor.name,
          fieldType   = Reflect.getMetadata('design:type', target, fieldName)
    
    if (fieldType === Array) {
      this.validateType(entityName, fieldName, typeHint, true)
    } else {
      this.validateType(entityName, fieldName, fieldType)
    }
    
    if (fieldType === Object) {
      if (indexed) throw(`${entityName}/${fieldName}: Plain objects cannot be indexed`)
    }

    const tempMap   = this.tempEntityFieldsMap,
          entityObj = tempMap[entityName] || (tempMap[entityName] = {}),
          field     = new MeField(fieldName, fieldType, typeHint, mandatory, indexed, unique)

    field.accessor = new FieldAccessor(entityName, fieldName, field)
    if (entityObj[fieldName]) throw(`${entityName}/${fieldName}: has been annotated twice?`)

    entityObj[fieldName] = Object.freeze(field)
    return field.accessor.getAccessor()
  }

  private checkInitStatus(actName: string) {
    if (!this.tempEntityFieldsMap) {
      throw(`Trying to ${actName} after Muds.init(). Forgot to add to entities collection?`)
    }
  }

  private validateType(entityName: string, fieldName: string, fieldType: any, insideArray ?: boolean) {

    // can happen only for array
    const id = `${entityName}/${fieldName}: `
    if (!fieldType) throw(id + 'typeHint is mandatory')

    if ([String, Number].indexOf(fieldType) !== -1) return
    if (!insideArray && [Boolean, Object].indexOf(fieldType) !== -1) return

    if (MudsBaseStruct.prototype.isPrototypeOf(fieldType.prototype)) {
      if (fieldType === MudsBaseEntity || fieldType === MudsBaseStruct) throw(id + 
        'Cannot be Muds.BaseEntity/Muds.BaseStruct. Use drived class of Muds.BaseStruct')

      if (MudsBaseEntity.prototype.isPrototypeOf(fieldType.prototype)) throw(id + 
        'Cannot be of type Muds.BaseEntity. Use Muds.BaseStruct')
      return  
    }
    throw(`${id}unknown type: ${fieldType.name}`)
  }

  init(rc : RunContextServer, gcloudEnv : GcloudEnv) {

    if (!this.tempEntityFieldsMap) throw(`Second attempt at Muds.init()?`)

    this.entityNames = Object.keys(this.entityInfoMap)

    for (const entityName of this.entityNames) {

      const ancestors   = this.extractFromMap(this.tempAncestorMap, entityName),
            fieldsMap   = this.extractFromMap(this.tempEntityFieldsMap, entityName),
            compIndices = this.extractFromMap(this.tempCompIndices, entityName),
            entityInfo  = this.entityInfoMap[entityName]

      if (entityInfo.entityType === EntityType.Dummy) {
        rc.isAssert() && rc.assert(rc.getName(this), !(ancestors || fieldsMap || compIndices), 
          `dummy cannot have any other annotation ${entityName}?`)
      } else {
        rc.isAssert() && rc.assert(rc.getName(this), fieldsMap, `no fields found for ${entityName}?`)
      }

      if (ancestors) this.valAndProvisionAncestors(rc, ancestors, entityInfo)

      // As fields are readonly, info is copied into them
      Object.assign(entityInfo.fieldMap, fieldsMap)
      entityInfo.fieldNames.push(...Object.keys(entityInfo.fieldMap))

      if (compIndices) this.valAndProvisionCompIndices(rc, compIndices, entityInfo)
    }

    this.validateIndices(rc)

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

    const id = `valAndProvisionAncestors ${entityInfo.entityName}:`
    for (const ancestor of ancestors) {
      const ancestorInfo = this.entityInfoMap[ancestor.name]
      rc.isAssert() && rc.assert(rc.getName(this), ancestorInfo, 
        `${id} Missing dummy/entity annotation on ${ancestor.name}?`)

      rc.isAssert() && rc.assert(rc.getName(this), ancestorInfo.entityType !== EntityType.Struct, 
        `${id}: Cannot have struct ${ancestor.name} as ancestor?`)
        
      entityInfo.ancestors.push(ancestorInfo)
    }
  }

  private valAndProvisionCompIndices( rc : RunContextServer, 
                                      compIndices: Mubble.uObject<Muds.Asc | Muds.Dsc>[], 
                                      entityInfo: MudsEntityInfo) {

    for (const compIdx of compIndices) {
      const idxs = Object.keys(compIdx)
      for (const idx of idxs) {
        MudsUtil.checkIndexed(rc, this.entityInfoMap, idx, entityInfo.entityName)
      }
      entityInfo.compositeIndices.push(compIdx)
    }
    Object.freeze(entityInfo.compositeIndices)
  }

  private validateIndices(rc : RunContextServer) {

    for (const entityName of this.entityNames) {
      const info = this.entityInfoMap[entityName]

      for (const fieldName of info.fieldNames) {
        const me = info.fieldMap[fieldName],
              cls = MudsUtil.getStructClass(me)

        if (cls) {

          const structName    = cls.name,
                indexedFields = this.areFieldsIndexed(rc, structName, entityName),
                uniqueField   = this.hasUniqueField(rc, structName, entityName),
                strIndexed    = (indexedFields ? '' : 'un') + 'indexed'

          rc.isAssert() && rc.assert(rc.getName(this), !(Number(me.indexed) ^ Number(indexedFields)),
            `${entityName}/${fieldName} should be '${strIndexed}' as struct is '${strIndexed}'`)

          uniqueField && rc.isAssert() && rc.assert(rc.getName(this), me.fieldType !== Array,
            `${entityName}/${fieldName} array cannot have unique members`)
        }
      }
    }
  }

  private areFieldsIndexed(rc: RunContextServer, structName: string, entityName: string) {
    const structInfo = this.entityInfoMap[structName]
    rc.isAssert() && rc.assert(rc.getName(this), structInfo,
      `${structName}' is not annotated as MudsStruct. Used in ${entityName}`)

    for (const sf of structInfo.fieldNames) {
      const sfm = structInfo.fieldMap[sf]
      if (sfm.indexed) return true
    }
    return false
  }

  private hasUniqueField(rc: RunContextServer, structName: string, entityName: string) {
    const structInfo = this.entityInfoMap[structName]
    rc.isAssert() && rc.assert(rc.getName(this), structInfo,
      `${structName}' is not annotated as MudsStruct. Used in ${entityName}`)

    for (const sf of structInfo.fieldNames) {
      const sfm = structInfo.fieldMap[sf]
      if (sfm.unique) return true
    }
    return false
  }


  private finalizeDataStructures(rc: RunContextServer) {

    const props = ['tempEntityFieldsMap', 'tempAncestorMap', 'tempCompIndices'],
          obj   = this as any
    for (const prop of props) {
      const keys = Object.keys(obj[prop])
      rc.isAssert() && rc.assert(rc.getName(this), !keys.length, 
      ` ${prop} is not empty. Has: ${keys}`);

      obj[prop] = null
    }

    Object.freeze(this.entityInfoMap)
    Object.freeze(this)
  }
}