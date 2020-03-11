/*------------------------------------------------------------------------------
	About      : Sms providers scoring
	
	Created on : Mon Mar 02 2020
	Author     : Vedant Pandey
	
	Copyright (c) 2020 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { SmsError, 
				 SmsErrorCodes, 
				 SmsErrorMessages 
			 }                    from './sms-errors'
import { RunContextServer } from '../rc-server'
import { RedisWrapper }     from '../cache'
import { 
				 format 
			 }   									from '@mubble/core'
import { Provider }         from './sms-interfaces'
import * as lo  						from 'lodash'
import { SmsConstants } from './sms-constants'


interface GatewayScore {
	lastWeightedAverage : number
	currentTotal        : number
	currentCount        : number
}

export class GatewayScoring {

	private providers : Array<Provider>
	private vRedis		: RedisWrapper

	constructor(rc : RunContextServer, trRedis : RedisWrapper, providers : Array<Provider>) {
		this.providers = providers
		this.vRedis		 = trRedis
	}

	public get providerList() : Array<Provider> {
		return this.providers
	}

	/**
	 * Populates the providers list for global use
	 * 
	 * @param rc Run context
	 * @param providers Array of providers
	 * 
	 * @returns void
	 */
	public populateProviders(rc : RunContextServer, providers : Array<Provider>) {
		this.providers = providers
	}

	/**
	 * Finds the best fit provider
	 * 
	 * @param rc Run context
	 * @param ts timestamp to fetch provider score
	 * @param excludedGws Providers to be excluded
	 * 
	 * @returns name of the provider
	 */
	public async findBestGatewayProvider(rc : RunContextServer, ts : number, excludedGws ?: Array<string>) : Promise<string> {

		const providers : Array<string> = this.getAllGatewayProviders()

		if (!providers.length) {
			rc.isError() && rc.error(rc.getName(this), 'No provider available', providers)
			throw new SmsError(SmsErrorCodes.PROVIDER_NOT_AVAILABLE, SmsErrorMessages.PROVIDER_NOT_AVAILABLE)
		}

		if (excludedGws && excludedGws.length) {
			lo.pullAll(providers, excludedGws)
			rc.isDebug() && rc.debug(rc.getName(this), `Excluded ${excludedGws.length} from consideration,`,
															 `since they failed earlier. ${excludedGws}`)
		}

		if (providers.length === 1) return providers[0]

		let filteredProviders

		try {
			const resp = await this.vRedis.redisCommand().mget(...(providers.map(provider => 
				SmsConstants.REDIS_PROVIDER_DOWN + provider
			)))
			filteredProviders = providers.filter((_, index) => (resp[index] || 0) <= SmsConstants.MAX_GW_FAIL_COUNT)
		} catch (e) {
			rc.isError() && rc.error(rc.getName(this), 'No working provider available.', filteredProviders)
			throw new SmsError(SmsErrorCodes.PROVIDER_NOT_AVAILABLE, SmsErrorMessages.PROVIDER_NOT_AVAILABLE)
		}


		if (filteredProviders.length > 0) {
			if (filteredProviders.length === 1) {
				rc.isDebug() && rc.debug(rc.getName(this), 
					`After performance consideration, only one provider left, returning ${filteredProviders[0]}`
				)

				return filteredProviders[0]
			}

			const scores = await Promise.all(filteredProviders.map(provider => 
				this.getGatewayProviderScore(rc, provider, ts)
			))

			lo.sortBy(scores, (score) => score.score)

			let winningScore = scores[0].score,
					winningGw		 = scores[0].provider

			rc.isDebug() && rc.debug(rc.getName(this), `Best gw provider : ${winningGw} with score : ${winningScore}.`)

			return winningGw
		} else {
			rc.isError() && rc.error(rc.getName(this), 'No working provider available.', filteredProviders)
			throw new SmsError(SmsErrorCodes.PROVIDER_NOT_AVAILABLE, SmsErrorMessages.PROVIDER_NOT_AVAILABLE)
		}
	}

	/**
	 * Updates the downtime count of provider
	 * 
	 * @param rc Run context
	 * @param gw Name of provider whose downtime needs to be updated
	 * @param failed Flag signifying if provider failed
	 * 
	 * @returns void
	 */
	public async updateGatewayDownTime(rc : RunContextServer, gw : string, failed : boolean) {

		const key		= SmsConstants.REDIS_PROVIDER_DOWN + gw,
					multi = this.vRedis.redisMulti()

		try {
			rc.isDebug() && rc.debug(rc.getName(this), 'updateGatewayDownTime', { gw : gw, failed : failed })
			if (failed) {
				multi.incr(key) // Increase downtime if failed
			} else {
				multi.set(key, 0) // Otherwise reset the downtime to zero
			}

			multi.expire(key, SmsConstants.REDIS_DOWN_EXPIRY_MS / 1000) 
			await this.vRedis.execRedisMulti(multi)
		} catch (e) {
			rc.isError() && rc.error(rc.getName(this), `Error in updating gw down time : ${e}`)
		}
	}

	/**
	 * Updates the score of provider iff lock is available
	 * 
	 * @param rc Run context
	 * @param gw name of provider whose score needs to be updated
	 * @param ts timestamp
	 * 
	 * @returns void
	 */
	public async updateGatewayProviderPerformance(rc : RunContextServer, gw : string, ts : number, msTaken : number) {

		const providerLocked = await this.checkGatewayLock(rc, gw, ts)
		if (providerLocked) return

		const hhmm 	= this.recentHHMM(rc, ts),
					key		= SmsConstants.REDIS_PROVIDER_HHMM_SCORE + gw + SmsConstants.REDIS_SEP + hhmm,
					multi	= this.vRedis.redisMulti()

		try {
			rc.isDebug() && rc.debug(rc.getName(this), 'updateGatewayProviderPerformance', 
															 { gw, ts, msTaken })

			{
				(await this.vRedis.redisCommand().exists(key)) // Check if the key is present in redis
				||
				(await this.refreshGatewayProviderScore(rc, gw, ts)) // Iff key is not present then refresh the gateway score
			}

			const scoreObj = JSON.parse(await this.vRedis.redisCommand().get(key))
			scoreObj.currentTotal += msTaken
			scoreObj.currentCount ++

			multi.set(key, JSON.stringify(scoreObj))
			multi.expire(key, SmsConstants.REDIS_SCORE_EXPIRY_MS / 1000)

			await this.vRedis.execRedisMulti(multi)
		} catch (e) {
			rc.isError() && rc.error(rc.getName(this), `Error in updating gw provider performance : ${e}.`)
		}

	}

	/*----------------------------------------------------------------------------
														INTERNAL SUPPORT FUNCTIONS
	----------------------------------------------------------------------------*/

	// Fetches all the providers in the system
	private getAllGatewayProviders() {
		const providers : Array<string> = Object.keys(this.providers)
		return providers
	}

	// Checks if the provider score is currently locked
	private async checkGatewayLock(rc : RunContextServer, gw : string, ts : number) {
		const key = SmsConstants.REDIS_PROVIDER_HHMM_LOCK + gw + SmsConstants.REDIS_SEP + this.recentHHMM(rc, ts)
		return await this.vRedis.redisCommand().exists(key)
	}

	// Returns the current score of any gw provider
	private async getGatewayProviderScore(rc : RunContextServer, 
																				gw : string, 
																				ts : number) {

		const hhmm	= this.recentHHMM(rc, ts),
					key		= SmsConstants.REDIS_PROVIDER_HHMM_SCORE + gw + SmsConstants.REDIS_SEP + hhmm,
					found	= await this.vRedis.redisCommand().exists(key)

		if (!found) await this.refreshGatewayProviderScore(rc, gw, ts)

		return { provider : gw, score : await this.getRedisKeyScore(rc, key) }
	}

	// Refreshes gw provider score or creates new if doesn't already exist
	private async refreshGatewayProviderScore(rc : RunContextServer, gw : string, ts : number) {

		try {
			await this.lockGatewayScoring(rc, gw, ts)
			let score           : number = 0,
					newTs           : number = ts - SmsConstants.TWELVE_HOUR_MS,
					weightageFactor : number = SmsConstants.LOWEST_WEIGHTAGE

			while(weightageFactor <= SmsConstants.HIGHEST_WEIGHTAGE) {
				const hhmm  = this.recentHHMM(rc, newTs),
							key   = SmsConstants.REDIS_PROVIDER_HHMM_SCORE + gw + SmsConstants.REDIS_SEP + hhmm,
							found = await this.vRedis.redisCommand().exists(key)

				let thisScore = 0
				if(found) thisScore = await this.getRedisKeyScore(rc, key)

				score += (thisScore * weightageFactor)
				newTs += SmsConstants.THIRTY_MINUTE_MS
				weightageFactor++
			}

			score = score / SmsConstants.TOTAL_WEIGHTAGE
	
			const scoreObj : GatewayScore = {
				lastWeightedAverage : score,
				currentTotal        : 0,
				currentCount        : 0
			}
	
			const hhmm  = this.recentHHMM(rc, ts),
						key   = SmsConstants.REDIS_PROVIDER_HHMM_SCORE + gw + SmsConstants.REDIS_SEP + hhmm,
						multi = this.vRedis.redisMulti()
	
			multi.set(key, JSON.stringify(scoreObj))
			multi.expire(key, SmsConstants.REDIS_SCORE_EXPIRY_MS / 1000)
			await this.vRedis.execRedisMulti(multi)
			await this.unlockGatewayScoring(rc, gw, ts)
		} catch(err) {
			rc.isError() && rc.error(rc.getName(this), `Error in refreshing gw provider score : ${err}.`)
		}
	}

	// Unlock the provider for editing the score
	private async unlockGatewayScoring(rc : RunContextServer, gw : string, ts : number) {
		const key = SmsConstants.REDIS_PROVIDER_HHMM_LOCK + gw + SmsConstants.REDIS_SEP + this.recentHHMM(rc, ts)
		return await this.vRedis.redisCommand().del(key)
	}

	// Lock the provider for editing the score
	private async lockGatewayScoring(rc : RunContextServer, gw : string, ts : number) {
		const key 	= SmsConstants.REDIS_PROVIDER_HHMM_LOCK + gw + SmsConstants.REDIS_SEP + this.recentHHMM(rc, ts),
					multi	= this.vRedis.redisMulti()

		multi.set(key, Date.now() + SmsConstants.SCORE_LOCK_MS, 'NX')
		multi.expire(key, SmsConstants.SCORE_LOCK_MS / 1000)

		return await this.vRedis.execRedisMulti(multi)
	}

	// Get the score of the redis key
	private async getRedisKeyScore(rc : RunContextServer, redisKey : string) : Promise<number> {

		const scoreObj : GatewayScore = JSON.parse(await this.vRedis.redisCommand().get(redisKey))

		if(scoreObj.currentCount > 0) {
			return ((scoreObj.lastWeightedAverage * (SmsConstants.TOTAL_WEIGHTAGE - SmsConstants.HIGHEST_WEIGHTAGE))
							+ ((scoreObj.currentTotal * SmsConstants.HIGHEST_WEIGHTAGE) / scoreObj.currentCount)) / SmsConstants.TOTAL_WEIGHTAGE
		} else {
			return scoreObj.lastWeightedAverage
		}
	}

	// Get the HH:MM nearest to the timestamp
	private recentHHMM(rc : RunContextServer, ts ?: number) {
		if(!ts) ts = Date.now()
		const nearest30minTS = ts - (ts % SmsConstants.THIRTY_MINUTE_MS)

		return format(new Date(nearest30minTS), '%hh%:%MM%')
	}

}