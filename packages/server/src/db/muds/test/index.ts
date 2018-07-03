
/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Mon Jul 02 2018
   Author     : Akash Dathan
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {  Muds }                                  from '../muds'
import {  RunContextServer }                      from '../../../rc-server'
import {  TestUtils }                             from './utils'
import * as models                                from './models'

export class MudsTests {

  private ts = Date.now()
  async run(rc : RunContextServer) {

    try {

      await TestUtils.cleanUp(rc)
      await TestUtils.prepareData(rc, this.ts, this.ts + 1, this.ts + 2)

      await this.testCase1(rc)
      await this.testCase2(rc)
      await this.testCase3(rc)
      
    } catch(error) {

      rc.isError() && rc.error(rc.getName(this), 'Tests Runnning Failed', error)
    } finally {

      await TestUtils.cleanUp(rc)
    }
  }

  /**
   * Simultaneous update test
   * - try to update the inserted record simultaneously from two transactions.
   * 
   * Models Used 
   *  - Parent   -> Parent model
   *  - KeyValue -> child model
   * 
   *  - Update the KeyVal entry with key = (ts + 1)
   */
  private async testCase1(rc : RunContextServer) {
    const testString = 'Update the inserted record simultaneously from two transactions'

    rc.isDebug() && rc.debug(rc.getName(this),`1) ${testString}`)
    
    try {
      await Promise.all([
        TestUtils.updateKeyValue(rc, this.ts, this.ts + 1, { strValue : 'From First update function' }),
        TestUtils.updateKeyValue(rc, this.ts, this.ts + 1, { strValue : 'From Second update function' })
      ])

      rc.isDebug() && rc.debug(rc.getName(this), `Success : ${testString}`)
    } catch(error) {
      rc.isError() && rc.error(rc.getName(this), testString, error)
    }
  }

  /**
   * Multiple entities of same ancestor are updated in the same transaction.
   * 
   * Models Used 
   *  - Parent   -> Parent model
   *  - KeyValue -> child model
   * 
   *  - Update the KeyVal entry with key = (ts + 1) and (ts + 2)
   */
  private async testCase2(rc : RunContextServer) {
    const testString = 'Multiple entities of same ancestor update test.'

    rc.isDebug() && rc.debug(rc.getName(this),`2) ${testString}`)

    try {
      const updateRec = { strValue : 'Updated String Value' }

      await Muds.transaction(rc, async (transaction, now) => {
        const parentKey = Muds.getIntKey(this.ts),
              keyVal1   = await transaction.getForUpsert(models.KeyValue, parentKey, Muds.getIntKey(this.ts + 1)),
              keyVal2   = await transaction.getForUpsert(models.KeyValue, parentKey, Muds.getIntKey(this.ts + 2))

        Object.assign(keyVal1, updateRec)
        Object.assign(keyVal2, updateRec)

        await Promise.all([
          transaction.upsert(keyVal1),
          transaction.upsert(keyVal2)
        ])
      })

      rc.isDebug() && rc.debug(rc.getName(this), `Success : ${testString}`)

    } catch(error) {
      rc.isError() && rc.error(rc.getName(this), testString, error)
    }
  }

  /**
   * Insert same id from two transactions, after get.
   * 
   * Models Used 
   *  - Parent   -> Parent model
   *  - KeyValue -> child model
   * 
   *  - get For key 1234
   *  - insert (ts + 3) and (ts + 4)
   */
  private async testCase3(rc : RunContextServer) {
    const testString = 'Insert same id from two transactions, after get.'

    rc.isDebug() && rc.debug(rc.getName(this),`3) ${testString}`)

    try {
      
      await Muds.transaction(rc, async (transaction, now) => {

        await transaction.getEntityIfExists(models.KeyValue, Muds.getIntKey(1234))
  
        const parentKey = Muds.getIntKey(this.ts),
              keyVal1   = await transaction.getForUpsert(models.KeyValue, parentKey, Muds.getIntKey(this.ts + 3)),
              keyVal2   = await transaction.getForUpsert(models.KeyValue, parentKey, Muds.getIntKey(this.ts + 4))

        keyVal1.populateDummyValues(rc)
        keyVal2.populateDummyValues(rc)

        keyVal1.strValue = '3) From First Transaction'
        keyVal2.strValue = '3) From Second Transaction'

        await Promise.all([
          transaction.upsert(keyVal1),
          transaction.upsert(keyVal2)
        ])
      })

      rc.isDebug() && rc.debug(rc.getName(this), `Success : ${testString}`)

    } catch(error) {
      rc.isError() && rc.error(rc.getName(this), testString, error)
    }
  }
}