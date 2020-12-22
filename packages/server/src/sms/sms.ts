/*------------------------------------------------------------------------------
	 About      : Sms service
	 
	 Created on : Mon Mar 02 2020
	 Author     : Vedant Pandey
	 
	 Copyright (c) 2020 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { SmsErrorCodes,
				 SmsErrorMessages, 
				 SmsError
			 } 										 from './sms-errors'
import { SmsProviderConfig, 
				 SendSmsResponse,
				 SmsTransactionInfo,
				 Provider
			 }										 from './sms-interfaces'
import { RunContextServer }  from '../rc-server'
import { SmsLogger } 				 from './sms-logger'
import { RedisWrapper } 		 from '../cache'
import { GatewayScoring } 	 from './gw-scoring'
import { SmsSender } 				 from './sms-sender'
import { ActiveUserRequest } from './request'
import { SmsConstants } 		 from './sms-constants'
import * as lo							 from 'lodash'

export class Sms {

	private smsLogger		 : SmsLogger			 	// Service for logging the sms information
	private smsSender		 : SmsSender			 	// Service used in sending the sms
	private gwScorer		 : GatewayScoring 	// Service used in scoring and choosing the sms providers
	private logDirectory : string						// SMS Logs Directory

	private inited    : boolean

	public constructor(rc : RunContextServer, config : SmsProviderConfig, trRedis : RedisWrapper, logDirectory : string) {

		rc.isDebug() && rc.debug(rc.getName(this), 'Constructing new Sms instance.')
		this.verifySmsProviderConfig(rc, config)

		this.smsSender = new SmsSender(rc, config.PROVIDER_KEYS, logDirectory)
		this.smsLogger = new SmsLogger(rc, trRedis)
		this.gwScorer	 = new GatewayScoring(rc, trRedis, config.PROVIDERS)
	}

	public init(rc : RunContextServer) {

		if(this.inited) {
			throw Error('Calling init twice!')
		}

		// TODO : Init sms-logger
		this.inited = true
	}

	public close(rc : RunContextServer) {

		if(!this.inited) {
			rc.isWarn() && rc.warn(rc.getName(this), 'Sms not initialized. Not closing.')
			return
		}

		// TODO : Call sms-logger close

		this.smsLogger = null as any
		this.smsSender = null as any
		this.gwScorer  = null as any
		this.inited    = false
	}

	/**
	 * To be called when config changes
	 */
	public onConfigChange(rc : RunContextServer, config : SmsProviderConfig) {

		if(!this.inited) {
			rc.isError() && rc.error(rc.getName(this), 'Sms service was not initialized.')
			throw new SmsError(SmsErrorCodes.SMS_SERVICE_NOT_INITIALIZED, SmsErrorMessages.SMS_SERVICE_NOT_INITIALIZED)
		}

		this.verifySmsProviderConfig(rc, config)

		this.smsSender = new SmsSender(rc, config.PROVIDER_KEYS, this.logDirectory)
		this.gwScorer.populateProviders(rc, config.PROVIDERS)
	}

	/*----------------------------------------------------------------------------
																	API FUNCTIONS
	----------------------------------------------------------------------------*/

	/**
	 * Api to send the verification sms.
	 * 
	 * @param rc Run context
	 * @param smsInfo Object conataining service name, userId, smsTransId, and user mobile number
	 * @param sms Sms to be sent to user
	 */
	public async sendSms(rc 		 : RunContextServer,
											 smsInfo : SmsTransactionInfo,
											 sms		 : string) : Promise<SendSmsResponse> {

		if(!this.inited) {
			rc.isError() && rc.error(rc.getName(this), 'Sms not initialized.')
			throw new SmsError(SmsErrorCodes.SMS_SERVICE_NOT_INITIALIZED, SmsErrorMessages.SMS_SERVICE_NOT_INITIALIZED)
		}

		const isIndianNumber = SmsConstants.RX_INDIAN_MOBILE.test(smsInfo.mobileNo) 
		if (!isIndianNumber) {
			rc.isError() && rc.error(rc.getName(this), 'sendSms non Indian mobile number provided.')
			throw new SmsError(SmsErrorCodes.NOT_INDIAN_MOBILE_NUMBER, SmsErrorMessages.NOT_INDIAN_MOBILE_NUMBER)
		}

		try {
			const request : ActiveUserRequest = await this.smsLogger.getActiveUserRequest(rc, smsInfo)

			if (request.gw) {
				await this.smsLogger.logVerificationStatus(rc, request)
				request.reinitializeRequest(rc, { ts : 0, gw : '', gwTranId : '', gwRespMs : 0, gwSendMs : 0 })
			} else if (request.failedGws.length) {
				await this.smsLogger.logVerificationStatus(rc, request, false)
			} else {
				rc.isError() && rc.error(rc.getName(this), 'sendSms Duplicated request.')
				throw new SmsError(SmsErrorCodes.DUPLICATED_REQUEST, SmsErrorMessages.DUPLICATED_REQUEST)
			}

			const ts										= Date.now(),
						gw										= await this.gwScorer.findBestGatewayProvider(rc, ts, request.failedGws),
						start									= Date.now(),
						{ success, gwTranId } = await this.smsSender.sendSms(rc, gw, request),
						now										= Date.now(),
						result								= {} as SendSmsResponse

			result.isIndianNumber = isIndianNumber
			result.smsSent 				= success

			await this.gwScorer.updateGatewayDownTime(rc, gw, !success)

			if (success) {
				rc.isDebug() && rc.debug(rc.getName(this), `Successfully sent SMS using ${gw}, SMS : ${request.sms}`)
				request.reinitializeRequest(rc, {ts, gw, gwTranId, gwRespMs : now - start,gwSendMs : -1})

				await this.smsLogger.updateActiveUserRequest(rc, request, now)

				result.msTaken = now - start
				return result
			}

			request.failedGws.push(gw)
			result.smsSendingFailureReason = SmsConstants.PROVIDER_SEND_FAILURE

			await this.smsLogger.updateActiveUserRequest(rc, request, now)
			rc.isDebug() && rc.debug(rc.getName(this), `Failure in sending SMS using ${gw}, SMS : ${request.sms}`)

			if (request.failedGws.length < this.gwScorer.providerList.length) { 
				return await this.sendSms(rc, smsInfo, sms)
			}
			return result
		} catch (e) {
			rc.isError() && rc.error(rc.getName(this), `Error in verifying number : ${e}.`, e)
			return { isIndianNumber, smsSent : false, smsSendingFailureReason : `${e}` }
		}
	}

	/**
	 * Api called when sms was sent succesfully
	 * 
	 * @param rc Run context
	 * @param smsInfo Object conataining service name, userId, smsTransId, and user mobile number
	 * @param msTaken Time taken by the provider to sed the sms
	 * @param manual flag signifying if the otp verification was manual or automatic
	 * @param cb callback to be used after internal tasks completed
	 * @param args argument(s) if required for callback
	 * 
	 * @returns The retval returned by the callback
	 */
	public async smsSuccess<T>(rc				: RunContextServer, 
														 smsInfo	: SmsTransactionInfo,
											 			 msTaken	: number, 
														 manual		: boolean, 
														 cb 		 ?: (...args : Array<any>) => Promise<T>,
														 ...args  : Array<any>) : Promise<T | void> {

		const isIndianNumber = SmsConstants.RX_INDIAN_MOBILE.test(smsInfo.mobileNo) 
		if (!isIndianNumber) {
			rc.isError() && rc.error(rc.getName(this), 'sendVerificationSms non Indian mobile number provided.')
			throw new SmsError(SmsErrorCodes.NOT_INDIAN_MOBILE_NUMBER, SmsErrorMessages.NOT_INDIAN_MOBILE_NUMBER)
		}

		if (!this.gwScorer || !this.smsSender) {
			rc.isError() && rc.error(rc.getName(this), 'sendVerificationSms config not initialized.')
			throw new SmsError(SmsErrorCodes.SMS_SERVICE_NOT_INITIALIZED, SmsErrorMessages.SMS_SERVICE_NOT_INITIALIZED)
		}

		let request : ActiveUserRequest = await this.smsLogger.getActiveUserRequest(rc, smsInfo)

		if (!request) {
			rc.isError() && rc.error(rc.getName(this), `Request for user ${smsInfo.userId} not found in cache.`)
			throw new SmsError(SmsErrorCodes.NO_ACTIVE_USER_REQUEST, SmsErrorMessages.NO_ACTIVE_USER_REQUEST)
		}

		if (manual) {
			const latestRecords = await this.smsLogger.getLatestUserSetRecords(rc),
						userIdExists	= (lo.indexOf(latestRecords, smsInfo.userId) !== -1)

			if (!userIdExists) {
				rc.isError() && rc.error(rc.getName(this), `Request for user ${smsInfo.userId} not found in cache.`)
				throw new SmsError(SmsErrorCodes.NO_ACTIVE_USER_REQUEST, SmsErrorMessages.NO_ACTIVE_USER_REQUEST)
			}
		}

		request.gwSendMs	= msTaken

		Promise.all([
			this.gwScorer.updateGatewayProviderPerformance(rc, request.gw, request.ts, msTaken),
			this.smsLogger.logVerificationStatus(rc, request, true),
		])

		await this.smsLogger.updateActiveUserRequest(
			rc, 
			request.reinitializeRequest(rc, { ts : 0, gw : '', gwRespMs : 0, gwSendMs : 0, failedGws : [] }), 
			Date.now()
		)

		if (cb) return await cb(...args)
	}

	/**
	 * Api called when sms was not sent succesfully
	 * 
	 * @param rc Run context
	 * @param smsInfo Object conataining service name, userId, smsTransId, and user mobile number
	 * @param cb Callback function to be called after internal tasks completed
	 * @param args argument(s) if required for callback
	 * 
	 * @returns The retval returned by the callback
	 */
	public async smsFailed<T>(rc 			 : RunContextServer,
														smsInfo	 : SmsTransactionInfo,
														cb			?: (...args : Array<any>) => Promise<T>,
														...args	 : Array<any>) : Promise<T | void> {
		let request : ActiveUserRequest =  await this.smsLogger.getActiveUserRequest(rc, smsInfo)

		const {service, userId, transactionId: smsTransId, mobileNo} = smsInfo

		if (!this.gwScorer || !this.smsSender) {
			rc.isError() && rc.error(rc.getName(this), 'sendVerificationSms config not initialized.')
			throw new SmsError(SmsErrorCodes.SMS_SERVICE_NOT_INITIALIZED, SmsErrorMessages.SMS_SERVICE_NOT_INITIALIZED)
		}

		if (!request || request.service !== service) {
			rc.isError() && rc.error(rc.getName(this), `Request for user ${userId} not found in cache`)
			throw new SmsError(SmsErrorCodes.NO_ACTIVE_USER_REQUEST, SmsErrorMessages.NO_ACTIVE_USER_REQUEST)
		}

		if (!this.checkRequestInfo(rc, request, mobileNo, smsTransId)) {
			rc.isError() && rc.error(rc.getName(this), 'Skipping entry in SMS verification logs due to mismatch.',
				request,
				{ tranId: smsTransId, mobNo : mobileNo }
			)
			
			throw new SmsError(SmsErrorCodes.REQUEST_INFO_MISMATCH, SmsErrorMessages.REQUEST_INFO_MISMATCH)
		}

		Promise.all([
			this.smsLogger.logVerificationStatus(rc, request, false),
			this.gwScorer.updateGatewayProviderPerformance(rc, request.gw, request.ts, Date.now() - request.ts),
		])

		await this.smsLogger.updateActiveUserRequest(
			rc,
			request.reinitializeRequest(rc, { ts : 0, gw : '', gwTranId : '', failedGws : [request.gw] }),
			Date.now()
		)

		if (cb) return await cb(...args)
	}

	/*----------------------------------------------------------------------------
																PRIVATE FUNCTIONS
	----------------------------------------------------------------------------*/

	private verifySmsProviderConfig(rc : RunContextServer, smsProviderConfig : SmsProviderConfig) {

		const providers		 = smsProviderConfig.PROVIDERS,
					providerKeys = smsProviderConfig.PROVIDER_KEYS

		if(!smsProviderConfig || !providers.length || !providerKeys) {
			rc.isError() && rc.error(rc.getName(this), 'SMS provider config not present or invalid.', smsProviderConfig,
															 providers, providerKeys)
			throw new SmsError(SmsErrorCodes.INVALID_SMS_CONFIG, SmsErrorMessages.INVALID_SMS_CONFIG)
		}

		for(const provider of providers) {
			if(!provider.name || provider.enabled === undefined) {
				rc.isError() && rc.error(rc.getName(this), 'Invalid provider config.', provider)
				throw new SmsError(SmsErrorCodes.INVALID_SMS_CONFIG, SmsErrorMessages.INVALID_SMS_CONFIG)
			}
		}

		const allProvidersDisabled = providers.every((provider : Provider) => provider.enabled === false)
		if(allProvidersDisabled) {
			rc.isError() && rc.error(rc.getName(this), 'All providers disabled.', providers)
			throw new SmsError(SmsErrorCodes.INVALID_SMS_CONFIG, SmsErrorMessages.INVALID_SMS_CONFIG)
		}

    const providerNames : Array<string> = []
    providers.forEach((provider : any) => providerNames.push(provider.name))

    if(this.containsDuplicates(providerNames)) {
      rc.isError() && rc.error(rc.getName(this), 'Duplicate config for one or more providers.', providerNames)
      throw new SmsError(SmsErrorCodes.INVALID_SMS_CONFIG, SmsErrorMessages.INVALID_SMS_CONFIG)
    }

		for (const provider of providers) {
			if (provider.enabled && !Object.keys(smsProviderConfig.PROVIDER_KEYS).length) {
				throw new SmsError(SmsErrorCodes.INVALID_SMS_CONFIG, SmsErrorMessages.INVALID_SMS_CONFIG)
			}
		}
	}

	checkRequestInfo(rc : RunContextServer, request : ActiveUserRequest, mobileNo : string, smsTransId : string) {
		rc.isDebug() && rc.debug(rc.getName(this), 'Checking request info mismatch...')
		return request.mobNo === mobileNo && request.tranId === smsTransId
	}
	
	// Returns true if duplicates present in arr
	private containsDuplicates(arr : Array<string>) {
		const uniqueArray = lo.uniq(arr)
		return (arr.length !== uniqueArray.length)
	}


}