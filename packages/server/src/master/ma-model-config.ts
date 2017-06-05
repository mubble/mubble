/*------------------------------------------------------------------------------
   About      : Model config interface and default Impl . Used to create master definition
   
   Created on : Mon Jun 05 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks protected Limited. All rights reserved.
------------------------------------------------------------------------------*/
import {RunContextServer}     from '../rc-server'
import {Master}               from './ma-base'
import {MasterRegistry , 
        FieldInfo}            from './ma-reg-manager'

import * as lo                from 'lodash'
import {concat , masterDesc }              from './ma-util'

        

export type MasterValidationRule = (rc : RunContextServer ,  reg : MasterRegistry , rec : any[]) => void
export const MasterTsField = 'modTs'

export abstract class ModelConfig {
  protected cache                 ?: boolean = false
  protected segment               ?: object  
  protected startVersion          : string|null  = null
  protected endVersion            : string|null  = null
  protected fkConstrains          : Master.ForeignKeys = {}
  protected dependencyMasters     : string [] = []
  protected masterTsField         : string = MasterTsField
  protected cachedFields          ?: {fields :  string [] , cache : boolean} 
  protected destSynFields         ?: {fields :  string [] , cache : boolean} 
  protected srcValidationrules     : MasterValidationRule []

  public getMasterTsField() : string {
    return this.masterTsField
  }
}

export class MasterModelConfig extends ModelConfig {
  
  public constructor(protected modConfigName : string){
    super()
    this.cachedFields =   {fields : [] , cache : false}
    this.destSynFields =  {fields : [] , cache : false}
    // Todo
    this.segment = {}
    
    this.srcValidationrules = [fieldTypeCheck]
  }


  test() : void {
    //this.
  }

}

function fieldTypeCheck(rc : RunContextServer ,  reg : MasterRegistry , records : any[]) {
  
  const autoCols : string [] = lo.clone(reg.autoFields) ,
        masterTsField : string = reg.config.getMasterTsField() ,
        fieldsMap : {[field : string] : FieldInfo} = lo.clone(reg.fieldsMap) ,
        optionalFields : string[] = lo.clone(reg.optionalFields),
        pkeys  = lo.clone(reg.pkFields),
        pkeysMap : {[field : string] : FieldInfo} = {}
        
        lo.filter(fieldsMap , (finfo : FieldInfo , key : string)=>{
          return finfo.masType === Master.FieldType.PRIMARY
        }).forEach(finfo =>{
          pkeysMap[finfo.name] = finfo
        })
        

  records.forEach(rec => {
    
    lo.forEach(rec  , (value : any , key : string  )=> {
      
      const fInfo : FieldInfo = fieldsMap[key]

      // Todo : If field is OPTIONAL allow
      if(!fInfo) throw (lo.concat(masterDesc(reg.mastername , key , value) ,'unknown field:' , key ,  reg.getIdStr(rec)))
      if(optionalFields.indexOf(key) !== -1) throw (lo.concat(masterDesc(reg.mastername , key , value) ,'can set auto field' , key ,  reg.getIdStr(rec)))
      

      // string , number , boolean , array check
      

    })

  })      

  



}
