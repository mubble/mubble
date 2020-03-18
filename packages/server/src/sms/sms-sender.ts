/*------------------------------------------------------------------------------
   About      : Sends SMS request using a SMS provider.
   
   Created on : Tue Mar 27 2018
   Author     : Vishal Sinha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/


import {
				 Acl,
				 GupShup,
				 Karix,
				 RouteMobile
			 }                        from './smsproviders'
import { 
				 SmsSendResponse,
				 SmsProviderClient,
				 SmsProvider
			 }                        from './sms-interfaces'
import { ActiveUserRequest }    from './request'
import { Mubble }               from '@mubble/core'
import { RunContextServer }     from '../rc-server'

const SmsClientMap : Mubble.uObject<typeof SmsProviderClient> = {
	[SmsProvider.ACL]          : Acl,
	[SmsProvider.GUPSHUP]      : GupShup,
	[SmsProvider.KARIX]        : Karix,
	[SmsProvider.ROUTE_MOBILE] : RouteMobile
}

export class SmsSender {

	private providercredentials  : Mubble.uObject<any>

	// TODO (Vedant) :
	// private acl : Acl | undefined

	constructor(rc : RunContextServer, providercredentials : Mubble.uObject<any>) {

		rc.isDebug() && rc.debug(rc.getName(this), 'Initializing SMS sender.', providercredentials)

		this.providercredentials  = providercredentials
	}

	async sendSms(rc      : RunContextServer,
								gw      : string,
								request : ActiveUserRequest) : Promise<SmsSendResponse> {

		try {
			return await this.sendSmsRequest(rc, gw, request)
		} catch(err) {
			rc.isError() && rc.error(rc.getName(this), err)
			return {success : false, gwTranId : gw + '_' + Date.now()}
		}
	}

	private async sendSmsRequest(rc      : RunContextServer,
															 gw      : string,
															 request : ActiveUserRequest) : Promise<SmsSendResponse> {

		rc.isDebug() && rc.debug(rc.getName(this), `Sending SMS using ${gw}.`)

		const clientType = SmsClientMap[gw],
					client     = new (clientType as any)() as SmsProviderClient

		return await client.request(rc, request, this.providercredentials[gw])
	}
}