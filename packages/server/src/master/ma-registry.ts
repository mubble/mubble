/*------------------------------------------------------------------------------
   About      : Master Registry Information + associated classes to store master details
   
   Created on : Tue Jun 06 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import "reflect-metadata"
import * as lo                from 'lodash'

import {RunContextServer}     from '../rc-server'
import {Master , MasterBase}  from './ma-base'
import {ModelConfig , 
  MasterValidationRule}       from './ma-model-config'  
import {masterDesc , assert , 
        concat , log ,
        throwError}           from './ma-util'   

const LOG_ID : string = 'MasterRegistry'
function MaRegMgrLog(...args : any[] ) : void {
  log(LOG_ID , ...args)
}

export const MASTERBASE : string = 'masterbase' //MasterBase.constructor.name.toLowerCase()

export type MasterFieldType = 'string' | 'object' | 'number' | 'boolean' | 'array'
//export type MasterFieldType = String | Number | Boolean | Object
export function getType(t : any) : MasterFieldType {
  switch(t){
    
    case Number     : return 'number'
    case String     : return 'string'
    case Boolean    : return 'boolean'
    case Object     : return 'object'
    case Array      : return 'array'

    default :
      assert(false , 'Unknown field type ',t)

  }
  // Never reachable
  return 'object'
}


export class FieldInfo {
  
  name    : string
  
  type    : MasterFieldType
  
  masType : Master.FieldType

  target  : object

  constructor(name : string , type : MasterFieldType , masType : Master.FieldType , target : object) {
    // Dont like using public specifier. For class members visibility
    this.name     = name
    this.type     = type
    this.masType  = masType
    this.target   = target
  }

  public toString() : string {
    return JSON.stringify({name : this.name, type : this.type , masType : this.masType}) 
  }

  // Is field ingerited from master base
  public isMasterBaseField() : boolean {
    return this.target.constructor.name === MASTERBASE
  }

}



export class MasterRegistry {
  
  constructor(master : string) {
    MaRegMgrLog('Creating Master ',master)
    this.mastername = master
  }

  mastername                : string
  
  construct                 : new (rc : any , ...args : any[]) => MasterBase
  
  masterInstance            : MasterBase
  
  pkFields                  : string[] = []
  
  fieldsMap                 : {[fieldName : string] : FieldInfo} = {}
  
  config                    : ModelConfig 

  autoFields                : string [] = []

  optionalFields            : string [] = []
  
  // Not inherited from masterbase
  ownFields                 : string [] = []

  allFields                 : string [] = []

  // Rules Array to verify fields type / value 
  // Equivalent of MasterConfig rules verification
  rules                     : ((obj : any) => void) [] = []

  // Get id string from master rec
  public getIdStr(src : any) : string {
    if(this.pkFields.length === 1) {
      assert(src[this.pkFields[0]] != null , 'Id field value can not be null ', this.mastername , this.pkFields[0] , src)
      return String(src[this.pkFields[0]])
    }

    const id : any = {}
    this.pkFields.forEach(pk =>{
      assert(src[pk] != null , 'Id field value can not be null ', this.mastername , pk , src )
      id[pk] = src[pk]
    })

    return JSON.stringify(id)
  }
  
  public verify(context : RunContextServer) {
    
    MaRegMgrLog('Verifying ',this.mastername)
    
    // Todo
    /*
    1. verify that field name must not contain the . or should not be empty
    2. Must have set at least 1 PK
    3. PK Fields can not be object
    4. Populate autofields + other populations
    5. It must be an Instance of MasterBase
    6. constructor must be present
    // not done yet
    7. config must be present 
    8. verify configuration
    9. Check all dependency masters are present
    */
    assert(this.pkFields.length > 0 , 'PK not set for master ', this.mastername)
    
    lo.forEach(this.fieldsMap,  (finfo : FieldInfo , key : string)=>{
      // 1 check
      assert( key.length > 0 && key.indexOf('.') === -1 , 'Invalid key ',key , masterDesc(this.mastername , key , null))

      if(finfo.masType === Master.FieldType.PRIMARY && finfo.type === 'object'){
        throwError('PK ',key , 'can not be object ',this.mastername)
      }

    })

    this.allFields = lo.keysIn(this.fieldsMap)

    this.autoFields = lo.filter(this.fieldsMap , (finfo : FieldInfo , key : string)=>{
      return finfo.masType === Master.FieldType.AUTO
    }).map(info=>info.name)
                        
    const masterTsField : string = this.config.getMasterTsField()                    
    if(this.autoFields.indexOf(masterTsField)===-1){
      this.autoFields.push(masterTsField)
    } 


    // set optional fields
    this.optionalFields = lo.filter(this.fieldsMap , (finfo : FieldInfo , key : string)=>{
      return finfo.masType === Master.FieldType.OPTIONAL
    }).map(info=>info.name)
    
    this.ownFields = lo.filter(this.fieldsMap , (finfo : FieldInfo , key : string)=>{
      return !finfo.isMasterBaseField()
    }).map(info=>info.name)
    

    assert(this.construct != null && this.config !=null , 'master class ',this.mastername , 'modelType definition missing')
    // In end create instance
    this.masterInstance = new this.construct(context , this.mastername)

    // check if this is an instance of master base
    assert(this.masterInstance instanceof MasterBase , this.mastername , 'is not an masterbase impl ')

    MaRegMgrLog(this.mastername , this.fieldsMap)
  }

  public addField(fieldName : string , masType : Master.FieldType , target : object) {
    
    MaRegMgrLog('addField', this.mastername , fieldName , masType )
    
    assert( !lo.hasIn(this.fieldsMap , fieldName)  , masterDesc(this.mastername , fieldName , null) , 'added again')
    var t = Reflect.getMetadata("design:type", target, fieldName)
    assert(t && t.name , masterDesc(this.mastername , fieldName , null) , 'field information is missing')
    
    let type : MasterFieldType = getType(t)
    this.fieldsMap[fieldName] = new FieldInfo(fieldName , type , masType ,  target)
  }

}

