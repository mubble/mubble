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
import { SmsConstants } 				from './sms-constants'
import * as lo									from 'lodash'

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
			const refTime = Date.now() - (SmsConstants.SMS_LOGGER_MS + 1  * 60 * 1000), // 1 minute offset for safety
						userIds	= await this.trRedis.rwZrangebyscore(SmsConstants.TREDIS_SMS_VERIFICATION_LOGS, 
																												 refTime,
																												 '+inf',
																												 false,
																												 0,
																												 SmsConstants.MAX_SMS_PER_ITERATION),
						keys		= userIds.map(userId => service + SmsConstants.PIPE_SEPARATOR + userId),
						multi		= this.trRedis.redisMulti(),
						smses		= [] as Array<SmsVerficationLog>

			let unknown 	= 0, 
					finished	= 0, 
					failed		= 0

			if (userIds.length) {
				const requestJSONs : Array<string> = await this.trRedis.redisCommand().hmget(SmsConstants.TREDIS_USER_REQUEST, ...keys)
				requestJSONs.forEach((requestJSON : string) => {
					const request : ActiveUserRequest = JSON.parse(requestJSON)
					if (request && request.gw) {
						unknown ++
						const smsLog = lo.cloneDeep(request) as any

						delete smsLog.failedGw
						smsLog.status = SmsConstants.VERIFICATION_UNKNOWN
						smses.push(smsLog as SmsVerficationLog)
					}
				})

				multi.hdel(SmsConstants.TREDIS_USER_REQUEST, ...keys)
				multi.zrem(SmsConstants.TREDIS_USER_SET, ...userIds)
				rc.isDebug() && rc.debug(rc.getName(this), `periodicSmsLogger,`,
																 `Cleaning cache. Deleted user cache : ${userIds.length}.`)
			}

			const smsLogs = await this.trRedis.redisCommand().lrange(SmsConstants.TREDIS_SMS_VERIFICATION_LOGS, 
																															 0, SmsConstants.MAX_SMS_PER_ITERATION - 1)

			if (smsLogs.length) {
				smsLogs.forEach((smsData : string) => {
					const smsLog = JSON.parse(smsData) as SmsVerficationLog
					smses.push(smsLog)

					if (smsLog.status === SmsConstants.VERIFICATION_UNKNOWN) 		 unknown ++
					else if (smsLog.status === SmsConstants.VERIFICATION_SUCCESS) finished ++
					else if (smsLog.status === SmsConstants.VERIFICATION_FAILED)  failed ++
				})

				multi.ltrim(SmsConstants.TREDIS_SMS_VERIFICATION_LOGS, smsLogs.length, -1)

				rc.isDebug() && rc.debug(rc.getName(this), `periodicSmsLogger,`,
																 `SMS results to be inserted to BigQuery : ${smses.length}.`,
																 `SMS with status unknown : ${unknown},`,
																 `finished successfully : ${finished}, and failed : ${failed}.`)
			}

			const bqArr : Array<BQSmsVerificationLog> = []

			if (smses.length) {
				smses.forEach((sms : SmsVerficationLog) => {
					const bqItem = new BQSmsVerificationLog(rc)
					bqItem.initModel(rc,
													 sms.service,
													 sms.userId,
													 sms.mobNo,
													 sms.tranId,
													 sms.sms,
													 sms.gwTranId,
													 sms.gw,
													 sms.status,
													 sms.ts,
													 sms.gwSendMs,
													 sms.gwRespMs
													)
					bqArr.push(bqItem)
				})
				const instance = new BQSmsVerificationLog(rc)
				
				await Promise.all([instance.bulkInsert(rc, bqArr), this.trRedis.execRedisMulti(multi)])
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
						key		 = request.service + SmsConstants.PIPE_SEPARATOR + userId,
						multi	 = this.trRedis.redisMulti()

			multi.hset(SmsConstants.TREDIS_USER_REQUEST, key, JSON.stringify(request))
			multi.zadd(SmsConstants.TREDIS_USER_SET, 'CH', ts, userId)
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
		return await this.trRedis.rwZrangebyscore(
			SmsConstants.TREDIS_USER_SET,
			Date.now() - SmsConstants.LATEST_RECORDS_MS,
			'+inf',
			true
		)
	}

	/**
	 * Gets the current active user request
	 * 
	 * @param rc Run context
	 * @param smsInfo Object conataining service name, userId, smsTransId, and user mobile number
	 */
	public async getActiveUserRequest(rc 			: RunContextServer, 
																		smsInfo : SmsTransactionInfo) : Promise<ActiveUserRequest> {

		const redisKey  : string 						= smsInfo.service + SmsConstants.PIPE_SEPARATOR 
																					+ smsInfo.userId + SmsConstants.PIPE_SEPARATOR 
																					+ smsInfo.transactionId + SmsConstants.PIPE_SEPARATOR 
																					+ smsInfo.mobileNo,
					parsedReq : ActiveUserRequest = JSON.parse(await this.trRedis.redisCommand()
																																			 .hget(SmsConstants.TREDIS_USER_REQUEST, redisKey)
																										)

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

		let status : string

		if (success === undefined) {
			status = SmsConstants.VERIFICATION_UNKNOWN
		} else if (success === true) {
			status = SmsConstants.VERIFICATION_SUCCESS
		} else {
			status = SmsConstants.VERIFICATION_FAILED
		}

		const smsLog : SmsVerficationLog = {...request, status}

		rc.isDebug() && rc.debug(rc.getName(this), 'logVerificationStatus', smsLog)
		return await this.trRedis.redisCommand()
														 .rpush(SmsConstants.TREDIS_SMS_VERIFICATION_LOGS, JSON.stringify(smsLog as SmsVerficationLog))

	}
}