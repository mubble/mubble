/*------------------------------------------------------------------------------
   About      : Master Registry Information + associated classes to store master details
   
   Created on : Tue Jun 06 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import "reflect-metadata"
import * as lo                from 'lodash'

import {RunContextServer}     from '../rc-server'
import {StringValMap , 
        GenValMap , 
       MasterCache }          from './ma-types'              
import {masterDesc , assert , 
        concat , log ,
        throwError , MaType}  from './ma-util'   

import {Master , MasterBase}  from './ma-base'
import {ModelConfig , 
  MasterValidationRule}       from './ma-model-config'
import {MasterRegistryMgr}    from './ma-reg-manager'  


const LOG_ID : string = 'MasterRegistry'
function MaRegistryLog(rc : RunContextServer | null , ...args : any[] ) : void {
  if(rc){
    rc.isStatus() && rc.status(LOG_ID , ...args )
  }else{
    //log(LOG_ID , ...args)
  }
}
function debug(rc : RunContextServer | null , ...args : any[] ) : void {
  if(rc){
    rc.isDebug && rc.debug(LOG_ID , ...args )
  }else{
    //log(LOG_ID , ...args)
  }
}


export const MASTERBASE : string = 'masterbase' //MasterBase.constructor.name.toLowerCase()

export type MasterFieldType = 'string' | 'object' | 'number' | 'boolean' | 'array'

//export type MasterFieldType = String | Number | Boolean | Object
function getType(t : any) : MasterFieldType {
  
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
  
  name        : string
  
  type        : MasterFieldType
  
  constraint  : Master.FieldType

  targetName  : string

  rules       : (( obj : any ) => void ) [] = []      

  constructor(name : string , targetName : string , type : MasterFieldType , constraint ?: Master.FieldType ) {
    
    // Dont like using public specifier. For class members visibility
    this.name         = name
    this.targetName   = targetName
    this.type         =  type
    
    if(MaType.isPresent<Master.FieldType>(constraint)) {
      this.constraint   = constraint
    }
  }



  public toString() : string {
    
    return JSON.stringify({name : this.name, type : this.type , constraint : Master.FieldType[this.constraint] , targetName : this.targetName}) 
  }

  // Is field inherited from master base
  public isMasterBaseField() : boolean {
    
    return this.targetName === MASTERBASE
  }

}



export class MasterRegistry {
  
  constructor(master : string) {
    MaRegistryLog(null , 'Creating Master ',master)
    this.mastername = master
  }

  mastername                : string
  
  //construct                 : new (rc : any , ...args : any[]) => MasterBase
  
  masterInstance            : MasterBase
  
  pkFields                  : string[] = []
  
  fieldsMap                 : {[fieldName : string] : FieldInfo} = {}
  
  config                    : ModelConfig 

  autoFields                : string [] = []

  optionalFields            : string [] = []
  
  // Not inherited from masterbase
  ownFields                 : string [] = []

  allFields                 : string [] = []

  // fields which are cached in memory
  cachedFields              : string [] = []

  destSyncFields            : string [] = []

  // Rules Array to verify fields type / value 
  // Equivalent of MasterConfig rules verification
  //rules                     : ((obj : any) => void) [] = []

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

  public getIdObject(src : any) : any {
    
    if(this.pkFields.length === 1) {
      assert(src[this.pkFields[0]] != null , 'Id field value can not be null ', this.mastername , this.pkFields[0] , src)
      return src[this.pkFields[0]]
    }

    const id : any = {}
    this.pkFields.forEach(pk =>{
      assert(src[pk] != null , 'Id field value can not be null ', this.mastername , pk , src )
      id[pk] = src[pk]
    })

    return id
  }
  
  /*
  1. verify that field name must not contain the . or should not be empty
  2. Must have set at least 1 PK
  3. PK Fields can not be object
  5. It must be an Instance of MasterBase
 */  
  public verifyInternal(construct : any) {
    
    assert(this.pkFields.length > 0 , 'PK not set for master ', this.mastername)
    
    lo.forEach(this.fieldsMap,  (finfo : FieldInfo , key : string)=>{
      // 1 check
      assert( key.length > 0 , 'Invalid key ',key , masterDesc(this.mastername , key , null))

      if(finfo.constraint === Master.FieldType.PRIMARY && finfo.type === 'object'){
        throwError('PK ',key , 'can not be object ',this.mastername)
      }

    })

    assert(construct != null && this.config !=null , 'master class ',this.mastername , 'modelType definition missing')
    
    this.masterInstance = new construct(null as any as RunContextServer , this.mastername)

    // check if this is an instance of master base
    assert(this.masterInstance instanceof MasterBase , this.mastername , 'is not an masterbase impl ')

  }

  public verify(context : RunContextServer) {
    
    MaRegistryLog(context , 'Verifying ',this.mastername)
    
    // Todo
    /*
    4. Populate autofields + other populations
    8. verify configuration
    9. Check all dependency masters are present
    */
    
    this.allFields = lo.keysIn(this.fieldsMap)

    this.autoFields = lo.filter(this.fieldsMap , (finfo : FieldInfo , key : string)=>{
      return finfo.isMasterBaseField()
    }).map(info=>info.name)
                        
    const masterTsField : string = this.config.getMasterTsField()                    
    if(this.autoFields.indexOf(masterTsField)===-1){
      this.autoFields.push(masterTsField)
    } 


    // set optional fields
    this.optionalFields = lo.filter(this.fieldsMap , (finfo : FieldInfo , key : string)=>{
      return finfo.constraint === Master.FieldType.OPTIONAL
    }).map(info=>info.name)
    
    this.ownFields = lo.filter(this.fieldsMap , (finfo : FieldInfo , key : string)=>{
      return !finfo.isMasterBaseField()
    }).map(info=>info.name)
    

    MaRegistryLog(context, this.mastername , 'FieldsMap:' , this.fieldsMap)

    lo.forEach(this.config.getDependencyMasters() , (parent : string)=>{
      assert(MasterRegistryMgr.getMasterRegistry(parent)!=null , 'parent ',parent , 'doesn\'t exists for master ',this.mastername)
    })

    // check FK contrains are okay
    const fkConst  : Master.ForeignKeys = this.config.getForeignKeys()

    lo.forEach(fkConst , (props : StringValMap , parent : string)=>{

      const parentRegistry : MasterRegistry = MasterRegistryMgr.getMasterRegistry(parent)
      // parent master must exists
      assert(parentRegistry!=null , 'parent ',parent , 'doesn\'t exists for master ',this.mastername)
      lo.forEach(props , (selfField : string , parentField : string)=>{
        // self field must exist
        assert(this.ownFields.indexOf(selfField)!==-1 , 'FK field ',selfField , 'is not present in master ',this.mastername)
        // parent master field must exists
        assert(parentRegistry.ownFields.indexOf(parentField)!==-1 , 'Parent FK field ',parentField , 'is not present in parent ',parent)

        const selfInfo : FieldInfo = this.fieldsMap[selfField]

        // can not be an optional field
        assert(!selfInfo.isMasterBaseField() && selfInfo.constraint !== Master.FieldType.OPTIONAL , 'FK field cant be optional or automatic',selfField , this.mastername )

        // can not be an array or object
        assert(selfInfo.type !== 'object' && selfInfo.type !== 'array' , 'FK field cant be object/array',selfField , this.mastername )
        
        // self field type must be same as parent field type
        assert(selfInfo.type === parentRegistry.fieldsMap[parentField].type , 'FK field type must match parent field type ', selfField , selfInfo.type , this.mastername , parent ,parentRegistry.fieldsMap[parentField].type  )

      })

    })


    // cached fields check
    // should be own field
    const cachedFields : {fields :  string [] , cache : boolean} = this.config.getCachedFields()
    cachedFields.fields.forEach((field : string)=>{
        assert(this.ownFields.indexOf(field)!=-1 , 'cached field',field , 'is not an own fields', this.ownFields , this.mastername)
    })
    
    // Populate Cached Fields
    if(cachedFields.cache){
     this.cachedFields  = lo.clone(cachedFields.fields) 
    }else{
     this.cachedFields = this.ownFields.filter(fld=>{
       return cachedFields.fields.indexOf(fld) === -1 
     }) 
    }
    assert(this.cachedFields.length>0  /*|| !this.config.getCached()*/ , 'No cached fields for master ',this.mastername)
    
    // destination sync fields check
    
    // should be own field
    const destFields : {fields :  string [] , cache : boolean} = this.config.getDestSynFields()
    destFields.fields.forEach((field : string)=>{
        assert(this.ownFields.indexOf(field)!=-1 , 'destSync field',field , 'is not an own fields', this.ownFields , this.mastername)
    })

    // Populate destination sync fields
    if(destFields.cache){
     this.destSyncFields  = lo.clone(destFields.fields) 
    }else{
     this.destSyncFields = this.ownFields.filter(fld=>{
       return destFields.fields.indexOf(fld) === -1 
     }) 
    }
    
    assert(this.destSyncFields.length>0 , 'No destination sync fields for master ',this.mastername)
    
    // dest sync fields should be sublist of cached fields
    this.destSyncFields.forEach(fld => {
      assert(this.cachedFields.indexOf(fld)!==-1 , 'dest field ',fld , 'is not cached',this.cachedFields , this.mastername)
    })

  }

  public addFieldRule(fieldName : string , target : object , rule : ((obj : any)=> void)) {
    
    MaRegistryLog(null , 'addFieldRule', this.mastername , fieldName )
    
    var t = Reflect.getMetadata("design:type", target, fieldName)
    assert(t && t.name , masterDesc(this.mastername , fieldName , null) , 'field information is missing')
    
    let type : MasterFieldType = getType(t)
    let targetName : string = target.constructor.name.toLowerCase()
    
    let finfo : FieldInfo = this.fieldsMap[fieldName]
    if(!finfo) {
      finfo = this.fieldsMap[fieldName] = new FieldInfo(fieldName , targetName , type )
    }

    assert(finfo.targetName === targetName && finfo.type === type , 'mismatch in field rule validation ',this.mastername , fieldName)

    finfo.rules.push(rule)
  }

  public addField(fieldName : string , masType : Master.FieldType , target : object) {
    
    MaRegistryLog(null , 'addField', this.mastername , fieldName , Master.FieldType[masType] )
    
    var t = Reflect.getMetadata("design:type", target, fieldName)
    assert(t && t.name , masterDesc(this.mastername , fieldName , null) , 'field information is missing')
    
    let type : MasterFieldType = getType(t)
    let targetName : string = target.constructor.name.toLowerCase()

    let finfo : FieldInfo = this.fieldsMap[fieldName]
    if(!finfo) {
      finfo = this.fieldsMap[fieldName] = new FieldInfo(fieldName , targetName , type , masType )
    }else{
      // It was already created by addFieldRule
      assert(finfo.constraint == null , 'contrain can not be populated before ',this.mastername , fieldName)
      finfo.constraint = masType
    }

    assert(finfo.targetName === targetName && finfo.type === type , 'mismatch in field rule validation ',this.mastername , fieldName)
  }

  public isAllowedFileUpload() {
    assert(this.config.getHasFileSource() , 'master', this.mastername , 'is not file sourced')
  }

  // Todo : create a model checksum
  public getModelDigest() : string {
    return 'newschat:'+this.mastername
  }

}

