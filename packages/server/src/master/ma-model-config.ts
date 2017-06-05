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

export type MasterValidationRule = (rc : RunContextServer ,  reg : MasterRegistry , rec : object) => void

export abstract class ModelConfig {
  protected cache                 ?: boolean = false
  protected segment               ?: object  
  protected startVersion          ?: string|null  = null
  protected endVersion            ?: string|null  = null
  protected fkConstrains          ?: Master.ForeignKeys = {}
  protected dependencyMasters     ?: string [] = []
  protected masterTsField         ?: string = 'modTs'
  protected cachedFields          ?: {fields :  string [] , cache : boolean} 
  protected destSynFields         ?: {fields :  string [] , cache : boolean} 
  protected srcValidationrules     : MasterValidationRule []
}

export class MasterModelConfig extends ModelConfig {
  
  public constructor(protected modConfigName : string){
    super()
    this.cachedFields =   {fields : [] , cache : false}
    this.destSynFields =  {fields : [] , cache : false}
    // Todo
    this.segment = {}
    
    this.srcValidationrules = [deletionCheck , fieldTypeCheck]
  }


  test() : void {
    //this.
  }

}


function deletionCheck(rc : RunContextServer ,  reg : MasterRegistry , rec : object) {

}

function fieldTypeCheck(rc : RunContextServer ,  reg : MasterRegistry , rec : object) {

}
