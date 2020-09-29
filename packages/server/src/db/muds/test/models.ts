/*------------------------------------------------------------------------------
   About      : Models Used for Testing
   
   Created on : Fri Jun 29 2018
   Author     : Akash Dathan
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {  Muds }                       from '../..'
import {  RunContextServer }           from '../../../rc-server'


@Muds.entity(1, Muds.Pk.Auto)
export class Parent extends Muds.BaseEntity {
  @Muds.indexed(Muds.Opt)   name : string

  public async populateDummyValues(rc : RunContextServer) {
    const strValues  = ['a', 'b', 'c']

    this.name = getRandom(strValues)
  }
}

@Muds.entity(1, Muds.Pk.Auto)
@Muds.ancestors(Parent)
@Muds.compositeIndex({ numValue: Muds.Asc, strValue: Muds.Dsc })
export class KeyValue extends Muds.BaseEntity {

  @Muds.field(Muds.Opt)     boolValue   : boolean
  @Muds.indexed(Muds.Opt)   numValue    : number
  @Muds.unique(Muds.Opt)    strValue    : string

  @Muds.field(Muds.Opt, String) 
                            arValue     : string[]

  public async populateDummyValues(rc : RunContextServer) {
    const boolValues = [true, false],
          strValues  = ['a', 'b', 'c']

    this.boolValue  = getRandom(boolValues)
    this.numValue   = Math.floor(Math.random() * 90 + 10)
    this.strValue   = getRandom(strValues)
    this.arValue    = strValues
  }
}

export function getRandom(arr : any[]) {
  return arr[Math.floor(Math.random() * arr.length)]
}

@Muds.struct()
export class TestObopay extends Muds.BaseStruct {
  @Muds.unique(Muds.Man) panNo  : string
  @Muds.unique(Muds.Man) adarNo : string
}


@Muds.entity(1, Muds.Pk.Auto)
export class TestUser extends Muds.BaseEntity {
  @Muds.unique(Muds.Man) email                : string
  @Muds.unique(Muds.Man) mobileNo             : string
  @Muds.field (Muds.Opt) name                 : string
  @Muds.indexed(Muds.Man) etcInfo             : TestObopay 
}


@Muds.entity(1, Muds.Pk.Auto)
@Muds.ancestors(TestUser)
export class ChildUser extends Muds.BaseEntity {
  @Muds.unique(Muds.Man) panNo  : string
  @Muds.field(Muds.Man)  name   : string
  @Muds.field(Muds.Opt)  dob    : number
}




/* ---------------------------------------------------------------------------
   C L I    C O M M A N D S
-----------------------------------------------------------------------------*/

/*

function await(pr) {
  pr.then(result => {
    global['_pr'] = result
  })
}
var Muds = require('@mubble/server').Muds
var Entities = require('./build/muds-entities/index.js')
var di = new Muds.DirectIo($.rc, Muds.manager)


var q = di.query(Entities.UserKeyValue)
q.filter('childValue.inNum', '=', 1)



var uk = di.getForInsert(Entities.UserKeyValue, Muds.getIntKey(1), Muds.getIntKey(2))

uk.boolValue = false
uk.strValue  = 'a'
uk.arValue = ['a']
uk.childValue = di.newStruct(Entities.ChildEntity)
uk.childValue.inNum = 1
uk.childValue.unStr = 'c'

uk.$dump()
await(di.upsert(uk))




var queue = di.getterQueue()
queue.add(Entities.UserKeyValue, Muds.getIntKey(1), Muds.getIntKey(2), Muds.getIntKey(3))
queue.add(Entities.UserKeyValue, Muds.getIntKey(1), Muds.getIntKey(2), Muds.getIntKey('5629499534213120'))
await(di.getEntities(queue))



var uk = di.getForInsert(Entities.UserKeyValue, Muds.getIntKey(1), Muds.getIntKey(2), Muds.getIntKey(7))
await(di.upsert(uk))


q.filter('childValue.inNum', '=', 1)
q.filter('arIdx.inNum', '=', 11)

var q = di.query(Entities.UserKeyValue)
await(q.run(10))

var entities = _pr.getCurrentRecs()
var uk = entities[0]

uk.arIdx[0].inNum = 11
uk.$dump()

await(di.upsert(uk))


_pr.$dump()
await(di.delete(...entities))
*/