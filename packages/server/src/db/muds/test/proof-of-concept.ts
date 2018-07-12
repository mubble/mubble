
/*------------------------------------------------------------------------------
   About      : One time test for Proof Of Concept
   
   Created on : Wed Jul 11 2018
   Author     : Akash Dathan
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {  Muds }                                  from '../muds'
import {  RunContextServer }                      from '../../../rc-server'
import * as models                                from './models'

/**
 * 
 * 1) Test against playground-india {count:0, hasMore:false, moreResults:"MORE_RESULTS_AFTER_LIMIT”})
 *    * Observation : {count:1, hasMore:false, moreResults:"NO_MORE_RESULTS"}
 * 
 * 2) Content table index assume is 'number of microsecs from 1 Jan 2050' (mpoch). 
 *    When we ask for content by content type, asc order __key__. This should not need index.
 *    * Observation : Order by __Key__ does not work, but the default order is ascending
 * 
 * 3) object.freeze: try modifying manager data.
 *    * Observation : works, data modification  failed.
 */

 export class POCTests {

  private ts = Date.now()

  /**
   * Test is the transaction is working when somebody updates the entity outside transaction
   */
  private async testCase1(rc : RunContextServer) {
    const testString = 'Updates the entity outside transaction.'

    rc.isDebug() && rc.debug(rc.getName(this),`1) ${testString}`)

    try {
      const updateRec = { strValue : 'Updated String Value' }

      const transactionPromise = Muds.transaction(rc, async (transaction, now) => {
        const parentKey = Muds.getIntKey(this.ts),
              keyVal1   = await transaction.getForUpsert(models.KeyValue, parentKey, Muds.getIntKey(this.ts + 1))

        Object.assign(keyVal1, updateRec)

        await transaction.upsert(keyVal1)
      })

      const directIoPromise = Muds.direct(rc, async (directIo, now) => {
        const parentKey = Muds.getIntKey(this.ts),
              keyVal1   = await directIo.getForUpsert(models.KeyValue, parentKey, Muds.getIntKey(this.ts + 1))

        Object.assign(keyVal1, updateRec)

        await directIo.upsert(keyVal1)
      })

      await Promise.all([transactionPromise, directIoPromise])

      /**
       * Observations :
       * 
       * 
       */

      rc.isDebug() && rc.debug(rc.getName(this), `Success : ${testString}`)

    } catch(error) {
      rc.isError() && rc.error(rc.getName(this), testString, error)
    }
  }

  /**
   * Test time taken in batching of 500 Vs 100 * 5 (Promise.all)
   */
  private async testCase2() {

  }
 }