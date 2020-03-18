/*------------------------------------------------------------------------------
	 About      : Logging and periodic archiving of information related to sms
	 
	 Created on : Mon Mar 02 2020
	 Author     : Vedant Pandey
	 
	 Copyright (c) 2020 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { RunContextServer } 		from '../rc-server'
import { RedisWrapper } 				from '../cache'
import { SmsVerficationLog } 		from './sms-interfaces'
import { ActiveUserRequest } 		from './request'
import { BQSmsVerificationLog } from './bq-models'
import { SmsTransactionInfo } 	from './sms-interfaces'
import * as lo									from 'lodash'


// TODO (Vedant) : Shift constants
			// Sms send results will belogged every 10 minutes
const SMS_LOGGER_MS 							 : number = 10 * 60 * 1000,
			// Ongoing user request. It is hash of service | userId and value is JSON of ActiveUserRequest.
			TREDIS_USER_REQUEST  				 : string = 'smsuser:user:request',
			// Set to keep all the ongoing user requests. It is an ordered set with score as ts when request was made and member as userId.
      TREDIS_USER_SET							 : string = 'smsuser:user:set',
			// Results of SMS dispatched. When ever client acknowledges, the result is captured in this list.
			TREDIS_SMS_VERIFICATION_LOGS : string = 'smsuser:verification:logs',
			// 10 minutes
			LATEST_RECORDS_MS						 : number = 10 * 60 * 1000,
			// Number of SMS data to be inserted in big-query in one iteration
			MAX_SMS_PER_ITERATION				 : number = 50

// Verification result
const VERIFICATION_SUCCESS				 : string = 'SUCCESS',
			VERIFICATION_FAILED 				 : string = 'FAILED',
			VERIFICATION_UNKNOWN				 : string = 'UNKNOWN',
			// Other constants
			PIPE_SEPARATOR							 : string = ' | '

export class SmsLogger {
	private trRedis : RedisWrapper

	constructor(rc : RunContextServer, trRedis : RedisWrapper) {
		rc.isDebug() && rc.debug(rc.getName(this), 'Initialize SMS logger.')
		this.trRedis = trRedis
	}

	/**
	 * Periodically logs the sms logs and pushes it to big query
	 * 
	 * @param rc - Run context
	 * @param service - The service currently using this module
	 */
	public async periodicSmsLogger(rc : RunContextServer, service : string) {

		try {
			const refTime = Date.now() - (SMS_LOGGER_MS + 1  * 60 * 1000), // 1 minute offset for safety
						userIds	= await this.trRedis.rwZrangebyscore(TREDIS_SMS_VERIFICATION_LOGS, 
																												 refTime,
																												 '+inf',
																												 false,
																												 0,
																												 MAX_SMS_PER_ITERATION),
						keys		= userIds.map(userId => service + PIPE_SEPARATOR + userId),
						multi		= this.trRedis.redisMulti(),
						smses		= [] as Array<SmsVerficationLog>

			let unknown 	= 0, 
					finished	= 0, 
					failed		= 0

			if (userIds.length) {
				const requestJSONs : Array<string> = await this.trRedis.redisCommand().hmget(TREDIS_USER_REQUEST, ...keys)
				requestJSONs.forEach((requestJSON : string) => {
					const request : ActiveUserRequest = JSON.parse(requestJSON)
					if (request && request.gw) {
						unknown ++
						const smsLog = lo.cloneDeep(request) as any

						delete smsLog.failedGw
						smsLog.status = VERIFICATION_UNKNOWN
						smses.push(smsLog as SmsVerficationLog)
					}
				})

				multi.hdel(TREDIS_USER_REQUEST, ...keys)
				multi.zrem(TREDIS_USER_SET, ...userIds)
				rc.isDebug() && rc.debug(rc.getName(this), `periodicSmsLogger,`,
																 `Cleaning cache. Deleted user cache : ${userIds.length}.`)
			}

			const smsLogs = await this.trRedis.redisCommand().lrange(TREDIS_SMS_VERIFICATION_LOGS, 
																															 0, MAX_SMS_PER_ITERATION - 1)

			if (smsLogs.length) {
				smsLogs.forEach((smsData : string) => {
					const smsLog = JSON.parse(smsData) as SmsVerficationLog
					smses.push(smsLog)

					if (smsLog.status === VERIFICATION_UNKNOWN) 		 unknown ++
					else if (smsLog.status === VERIFICATION_SUCCESS) finished ++
					else if (smsLog.status === VERIFICATION_FAILED)  failed ++
				})

				multi.ltrim(TREDIS_SMS_VERIFICATION_LOGS, smsLogs.length, -1)

				rc.isDebug() && rc.debug(rc.getName(this), `periodicSmsLogger,`,
																 `SMS results to be inserted to BigQuery : ${smses.length}.`,
																 `SMS with status unknown : ${unknown},`,
																 `finished successfully : ${finished}, and failed : ${failed}.`)
			}

			const bqArr : Array<BQSmsVerificationLog> = []

			if (smses.length) {
				smses.forEach((sms : SmsVerficationLog) => {
					bqArr.push(new BQSmsVerificationLog(rc, sms))
				})
				await BQSmsVerificationLog.insertBQItems(rc, bqArr)
				await this.trRedis.execRedisMulti(multi)
				rc.isDebug() && rc.debug(rc.getName(this), `periodicSmsLogger, ${smses.length} items inserted into Big Query.`)
			} else {
				rc.isDebug() && rc.debug(rc.getName(this), 'periodicSmsLogger, finished inserting items into Big Query.')
			}
		} catch (e) {
			rc.isError() && rc.error(rc.getName(this), 'periodicSmsLogger, Error in inserting items in BigQuery.')
		} finally {
			return
		}
	}

	/**
	 * To update and reset the active user request
	 * 
	 * @param rc Run context
	 * @param request Request to be updated as the currently active request
	 * @param ts Timestamp of the request
	 */
	public async updateActiveUserRequest(rc : RunContextServer, request : ActiveUserRequest, ts : number) {
		try {
			const userId = request.userId,
						key		 = request.service + PIPE_SEPARATOR + userId,
						multi	 = this.trRedis.redisMulti()

			multi.hset(TREDIS_USER_REQUEST, key, JSON.stringify(request))
			multi.zadd(TREDIS_USER_SET, 'CH', ts, userId)
			rc.isDebug() && rc.debug(rc.getName(this), 'updateActiveUserRequest', key, request)
			await this.trRedis.execRedisMulti(multi)
		} catch (e) {
			rc.isError() && rc.error(rc.getName(this), `Error in updating ActiveUserRequest : ${e}`)
		} finally {
			return
		}
	}

	/**
	 * @method getLatestUserSetRecords
	 */
	public async getLatestUserSetRecords(rc : RunContextServer) {
		return await this.trRedis.rwZrangebyscore(TREDIS_USER_SET, Date.now() - LATEST_RECORDS_MS, '+inf', true)
	}

	/**
	 * Gets the current active user request
	 * 
	 * @param rc Run context
	 * @param smsInfo Object conataining service name, userId, smsTransId, and user mobile number
	 */
	public async getActiveUserRequest(rc 			: RunContextServer, 
																		smsInfo : SmsTransactionInfo) : Promise<ActiveUserRequest> {

		const redisKey  : string 						= smsInfo.service + PIPE_SEPARATOR 
																					+ smsInfo.userId + PIPE_SEPARATOR 
																					+ smsInfo.transactionId + PIPE_SEPARATOR 
																					+ smsInfo.mobileNo,
					parsedReq : ActiveUserRequest = JSON.parse(await this.trRedis.redisCommand()
																																			 .hget(TREDIS_USER_REQUEST, redisKey))

		const req = new ActiveUserRequest({
			service 	    : smsInfo.service, 
			userId 		    : smsInfo.userId,
			mobileNo	    : smsInfo.mobileNo, 
			transactionId : smsInfo.transactionId
		})

		if (parsedReq) {
			const keys : Array<keyof ActiveUserRequest> = Object.keys(parsedReq) as Array<keyof ActiveUserRequest>
			for (const key of keys) {
				(req as any)[key] = parsedReq[key]
			}
		}

		rc.isDebug() && rc.debug(rc.getName(this), 'getActiveUserRequest', redisKey, req)
		return req
	}

	/**
	 * Logs the verification status of the request
	 * 
	 * @param rc Run context
	 * @param request Request whose verification status needs to be logged
	 * @param success Flag signifying the status of the request
	 */
	public async logVerificationStatus(rc 			: RunContextServer, 
																		 request  : ActiveUserRequest, 
																		 success ?: boolean) : Promise<number> {

		const requestClone = lo.cloneDeep(request)
		delete requestClone.failedGws

		const smsLog = requestClone as any as SmsVerficationLog

		if (success === undefined) 	smsLog.status = VERIFICATION_UNKNOWN
		else if (success === true)	smsLog.status = VERIFICATION_SUCCESS
		else if (success === false) smsLog.status = VERIFICATION_FAILED

		rc.isDebug() && rc.debug(rc.getName(this), 'logVerificationStatus', smsLog)
		return await this.trRedis.redisCommand()
														 .rpush(TREDIS_SMS_VERIFICATION_LOGS, JSON.stringify(smsLog as SmsVerficationLog))

	}
}