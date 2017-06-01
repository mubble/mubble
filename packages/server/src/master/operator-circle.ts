/*------------------------------------------------------------------------------
   About      : Dummy Master Data Classes using master decoraters
   
   Created on : Thu Jun 01 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {Master , MasterBase} from './ma-base'

@Master.modelType(Master.getDefaultConfig({} , '2.3.4' , '3.5.6'))
class operator extends MasterBase {
  @Master.primaryKey()
  name : string
}

@Master.modelType(Master.getDefaultConfig({} , '2.3.4' , '3.5.6'))
class circle extends MasterBase {
  @Master.primaryKey()
  name : string
}

@Master.modelType(Master.getDefaultConfig ({} , '2.3.4' , '3.5.6' , 
  {
    operator         : {name : 'operator'} ,
    circle           : {name : 'circle'}   
  }
))

class operatorcircle extends MasterBase {
  @Master.primaryKey()
  operator : string
  
  @Master.primaryKey()
  circle   : string 
}

@Master.modelType(Master.getDefaultConfig ({} , '2.3.4' , '3.5.6' , 
  
  {
    operator         : {name : 'operator'} ,
    circle           : {name : 'circle'}   ,
    operatorcircle   : {operator : 'operator' , circle : 'circle'}
  }

))
class SampleOperatorPlan extends MasterBase {

  // Please declare your primary keys first
  // ensure that you observe the order of keys
  // order of keys once declared cannnot be changed

  
  @Master.primaryKey()
  public operator : string
  
  @Master.primaryKey()
  public circle : string
  
  @Master.primaryKey()
  public rc       : number
  
  @Master.primaryKey()
  public mode     : string

  @Master.field()
  public currentPlan : object 
  
  @Master.field(Master.FieldType.OPTIONAL)
  public currentPlanEdited : object 

  @Master.field()
  public validFrom : number
  
  @Master.field()
  public validTill : number

}
