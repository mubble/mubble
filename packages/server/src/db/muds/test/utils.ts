/*------------------------------------------------------------------------------
   About      : Utils
   
   Created on : Mon Jul 02 2018
   Author     : Akash Dathan
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {  RunContextServer }                      from '../../../rc-server'
import {  Muds }                                  from '../muds'
import * as models                                from './models'

export class TestUtils {

  static async updateKeyValue(rc : RunContextServer, parentId : number,
                                           id : number, updateRec : {[i : string] : any}) {

    return await Muds.transaction(rc, async (transaction, now) => {
      const keyVal = await transaction.getForUpsert(models.KeyValue, Muds.getIntKey(parentId), Muds.getIntKey(id))

      Object.assign(keyVal, updateRec)

      await transaction.upsert(keyVal)
    })
  }
  
  /**
   * Populate the db wrt the provided parent and children keys
   *
   */
  static async prepareData(rc : RunContextServer, parentKey : any, ...childrenKeys : any[]) {
    return await Muds.direct(rc, async (directIo, now) => {

      const parent = await directIo.getForUpsert(models.Parent, Muds.getIntKey(parentKey))

      await parent.populateDummyValues(rc)
      await directIo.upsert(parent)

      if(!childrenKeys) return

      for(const childrenKey of childrenKeys) {
        const keyVal = await directIo.getForUpsert(models.KeyValue, Muds.getIntKey(parentKey), 
                                Muds.getIntKey(childrenKey))

        await keyVal.populateDummyValues(rc)
      
        await directIo.upsert(keyVal)
      }

    }) as models.KeyValue
  }

  /**
   * Delete all the Parent and KeyValue Entries
   * 
   */
  static async cleanUp(rc : RunContextServer) {
    const entitiesToDelete = [] as any[]

    await Muds.direct(rc, async (directIo, now) => {
      const keyValQuery = directIo.query(models.KeyValue),
            parentQuery = directIo.query(models.Parent),
            keyVals     = await keyValQuery.run(100),
            Parents     = await parentQuery.run(100)
    
      let keyVal
      while(keyVal = await keyVals.getNext())
        entitiesToDelete.push(keyVal)
      
      let parent
      while(parent = await Parents.getNext())
        entitiesToDelete.push(parent)

      if(entitiesToDelete.length)
        directIo.delete(...entitiesToDelete)
    })
  }
}