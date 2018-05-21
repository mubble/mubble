/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Sun May 20 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import 'reflect-metadata'
import * as Datastore       from '@google-cloud/datastore'

import { Muds   }           from "./muds"
import { MudsBaseEntity }   from "./muds-base-entity"
import { Mubble }           from '@mubble/core'
import { GcloudEnv }        from '../../gcp/gcloud-env'
import { RunContextServer } from '../..'

class MeField {
  constructor(readonly fieldName    : string,
              readonly fieldType    : String | Number | Boolean | Object,
              readonly isMandatory  : boolean,
              readonly isIndexed    : boolean,
              readonly isUnique     : boolean) {

    if (isUnique && !isIndexed) throw('Field cannot be unique without being indexed')            
  }
}

class MudsEntityInfo {
  
  readonly entityName  : string
  readonly ancestors   : MudsEntityInfo[]
  readonly fieldMap    : Mubble.uObject<MeField> = {}

  constructor(readonly cons        : {new(): MudsBaseEntity},
              readonly version     : number,
              readonly keyType     : Muds.Pk) {
    this.entityName = cons.name        
  }
}

export class MudsManager {

  private entityInfoMap: Mubble.uObject<MudsEntityInfo>

  registerEntity(version: number, pkType: Muds.Pk, cons: {new(): MudsBaseEntity}) {
    const info = new MudsEntityInfo(cons, version, pkType)
    this.entityInfoMap[info.entityName] = info
  }

  registerAncestors(ancestors: string[], cons: {new(): MudsBaseEntity}) {
    const info = this.getEntityInfo(cons)
    if (!info) throw(`Did not annotate entity, ${cons.name}?`)

    for (const ancestor of ancestors) {
      info.ancestors.push(this.getEntityInfo(cons) || ancestor)
    }
  }

  registerField({mandatory = false, indexed = false, unique = false}, target: any, fieldName: string) {

    const fieldType = Reflect.getMetadata('design:type', target.constructor, fieldName),
          field     = new MeField(fieldName, fieldType, mandatory, indexed, unique),
          info      = this.getEntityInfo(target)

    if (!info) throw(`Did not annotate entity, ${target.name}?`)
    if (info.fieldMap[fieldName]) throw(`Double annotation on field, ${target.name}/${fieldName}?`)
    
    info.fieldMap[fieldName] = field
  }

  private getEntityInfo(cons: {new(): MudsBaseEntity}) {
    const name = cons.name,
          info = this.entityInfoMap[name]

    return info
  }

  init(rc : RunContextServer, gcloudEnv : GcloudEnv) {
    if (gcloudEnv.authKey) {
      gcloudEnv.datastore = new Datastore({
        projectId   : gcloudEnv.projectId,
        credentials : gcloudEnv.authKey
      })
    } else {
      gcloudEnv.datastore = new Datastore({
        projectId   : gcloudEnv.projectId
      })
    }
  }
}