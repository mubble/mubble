/*------------------------------------------------------------------------------
   About      : Sends SMS request using a SMS provider.
   
   Created on : Tue Mar 27 2018
   Author     : Vishal Sinha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/


import {
				 Acl,
				 Gupshup,
				 Karix,
				 RouteMobile
			 }                        from './smsproviders'
import { 
				 SmsSendResponse,
				 SmsProvider,
				 ProviderConfigs,
				 ClientInfo,
				 ClientMap,
				 Client
			 }                        from './sms-interfaces'
import { SmsError, 
				 SmsErrorCodes, 
				 SmsErrorMessages } 		from './sms-errors'
import { ActiveUserRequest }    from './request'
import { RunContextServer }     from '../rc-server'

export class SmsSender {
	
	private providercredentials : ProviderConfigs
	private smsClientMap        : ClientMap = {}

	constructor(rc : RunContextServer, providercredentials : ProviderConfigs) {

		rc.isDebug() && rc.debug(rc.getName(this), 'Initializing SMS sender.', providercredentials)

		if (providercredentials.ACL) {
			this.smsClientMap.ACL = new Acl(rc, providercredentials.ACL.host)
		}
		if (providercredentials.KARIX) {
			this.smsClientMap.KARIX = new Karix(rc, providercredentials.KARIX.host)
		}
		if (providercredentials.GUPSHUP) {
			this.smsClientMap.GUPSHUP = new Gupshup(rc, providercredentials.GUPSHUP.host)
		}
		if (providercredentials.ROUTE_MOBILE) {
			this.smsClientMap.ROUTE_MOBILE = new RouteMobile(rc, providercredentials.ROUTE_MOBILE.host)
		}

		this.providercredentials  = providercredentials
	}

	async sendSms(rc      : RunContextServer,
								gw      : keyof typeof SmsProvider,
								request : ActiveUserRequest) : Promise<SmsSendResponse> {

		try {
			return await this.sendSmsRequest(rc, gw, request)
		} catch(err) {
			rc.isError() && rc.error(rc.getName(this), err)
			return {success : false, gwTranId : gw + '_' + Date.now()}
		}
	}

	private async sendSmsRequest(rc      : RunContextServer,
															 gw      : keyof typeof SmsProvider,
															 request : ActiveUserRequest) : Promise<SmsSendResponse> {

		rc.isDebug() && rc.debug(rc.getName(this), `Sending SMS using ${gw}.`)

		const client = this.smsClientMap[gw],
					creds	 = this.providercredentials[gw]
		if (!client) {
			rc.isError() && rc.error(rc.getName(this), 'Requesting provider without initialization.')
			throw new SmsError(SmsErrorCodes.PROVIDER_NOT_INITIALIZED, SmsErrorMessages.PROVIDER_NOT_INITIALIZED)
		}

		if (!creds) {
			throw new SmsError(SmsErrorCodes.INVALID_SMS_CONFIG, SmsErrorMessages.INVALID_SMS_CONFIG)
		}


		return await client.request<ClientInfo>(rc, request, { client, creds })
	}
}