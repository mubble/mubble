/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Sun May 20 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import 'reflect-metadata'
import * as Datastore       from '@google-cloud/datastore'

import { Muds   }           from "./muds"
import { MudsBaseEntity, 
         FieldAccessor  }   from "./muds-base-entity"
import { Mubble }           from '@mubble/core'
import { GcloudEnv }        from '../../gcp/gcloud-env'
import { RunContextServer } from '../..'

export class MeField {
  accessor: FieldAccessor
  constructor(readonly fieldName    : string,

              // Basic Type + other custom type are also allowed
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

export class MudsManager {

  private entityInfoMap       : Mubble.uObject<MudsEntityInfo> = {}
  private datastore           : Datastore
  private entityNames         : string[]

  // Temporary members while store schema is built
  private tempAncestorMap     : Mubble.uObject<{new(): Muds.BaseEntity}[]> | null = {}
  private tempEntityFieldsMap : Mubble.uObject<Mubble.uObject<MeField>> | null = {}

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
      if ([Number, String].indexOf(fieldType) === -1) throw(`Invalid type for indexed/unique field  ${
        entityName}/${fieldName}`)
    }

    let efm = this.tempEntityFieldsMap[entityName]
    if (!efm) this.tempEntityFieldsMap[entityName] = efm = {}

    if (efm[fieldName]) throw(`Double annotation on field, ${entityName}/${fieldName}?`)
    field.accessor = new FieldAccessor(entityName, fieldName, field)
    efm[fieldName] = Object.freeze(field)
    return field.accessor.getAccessor()
  }

  public init(rc : RunContextServer, gcloudEnv : GcloudEnv) {

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

  getInfo(entityClass: Function | {new (): MudsBaseEntity}): MudsEntityInfo {
    return this.entityInfoMap[entityClass.name]
  }

  private finalizeDataStructures() {

    this.tempEntityFieldsMap  = null
    this.tempAncestorMap      = null
    this.entityNames          = Object.keys(this.entityInfoMap)

    Object.freeze(this.entityInfoMap)
    Object.freeze(this)
  }

  getDatastore() {
    return this.datastore
  }



}