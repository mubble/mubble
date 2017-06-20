/*------------------------------------------------------------------------------
   About      : Dummy Master Data Classes using master decorators
   
   Created on : Thu Jun 01 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {RunContextServer}     from '../rc-server'
import {Master , MasterBase}  from './ma-base'

@Master.modelType(Master.getDefaultConfig({}))
export class Operator extends MasterBase {
  
  @Master.primaryKey()
  name : string

  public constructor(opr : string) {
    super(null as any as RunContextServer , Operator.constructor.name.toLowerCase())
    this.name = opr
  }
}

@Master.modelType(Master.getDefaultConfig({}))
export class Circle extends MasterBase {
  
  @Master.primaryKey()
  name : string

  public constructor(circle : string) {
    super(null as any as RunContextServer , Circle.constructor.name.toLowerCase())
    this.name = circle
  }
}

@Master.modelType(Master.getDefaultConfig ({} , 
  {
    operator         : {name : 'operator'} ,
    circle           : {name : 'circle'}   
  }
))

export class OperatorCircle extends MasterBase {
  
  @Master.primaryKey()
  operator : string
  
  @Master.primaryKey()
  circle   : string 

  public constructor(opr : string , cir: string) {
    super(null as any as RunContextServer , OperatorCircle.constructor.name.toLowerCase())
    this.operator = opr
    this.circle   = cir
  }
  
}

@Master.modelType(Master.getDefaultConfig ({} , 
  
  {
    operator         : {name : 'operator'} ,
    circle           : {name : 'circle'}   ,
    operatorCircle   : {operator : 'operator' , circle : 'circle'}
  }

))
export class SampleOperatorPlan extends MasterBase {

  // Please declare your primary keys first
  // ensure that you observe the order of keys
  // order of keys once declared cannot be changed
  public static checksum : string = '7543a7ad90a863d71d04173bfb552e20280676e7'
  
  @Master.primaryKey()
  public operator : string
  
  @Master.primaryKey()
  public circle : string
  
  @Master.primaryKey()
  public rc       : number
  
  @Master.primaryKey()
  public mode     : string

  @Master.field()
  public currentPlan :  object
  
  @Master.field(Master.FieldType.OPTIONAL)
  public currentPlanEdited : object 

  @Master.field()
  @Master.inRange(2000 , 2018)
  public validFrom : number
  
  @Master.field()
  public validTill : number

  public constructor() {
    
    super(null as any as RunContextServer , SampleOperatorPlan.constructor.name.toLowerCase())
  }

}
