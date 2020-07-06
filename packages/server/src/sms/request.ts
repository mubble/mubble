/*------------------------------------------------------------------------------
	 About      : Active User Request
	 
	 Created on : Mon Mar 26 2018
	 Author     : Vishal Sinha
	 
	 Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { RunContextServer } 	from '../rc-server'
import { SmsTransactionInfo } from './sms-interfaces'
import { Mubble } 						from '@mubble/core'

export class ActiveUserRequest {
	// Service name, example : 'Mubble' or 'SuddiKatte'
	service  : string

	userId   : string
	mobNo    : string
	tranId   : string

	sms      : string

	// This is populated when we are able to send the sms
	ts       : number // Request send time
	gwTranId : string
	gw       : string
	gwSendMs : number // Time taken by gw to send the SMS

	gwRespMs : number // Time taken by gw to respond to a request

	// This is set when last sms send failed or client acknowledged a failure
	failedGws : Array<string>

	constructor(smsInfo : SmsTransactionInfo) {
		this.service   = smsInfo.service

		this.userId    = smsInfo.userId
		this.mobNo     = smsInfo.mobileNo
		this.tranId    = smsInfo.transactionId

		this.sms       = ''

		this.ts        = 0
		this.gwTranId  = ''
		this.gw        = ''
		this.gwSendMs  = 0

		this.gwRespMs  = 0

		this.failedGws = []
	}

	reinitializeRequest(rc : RunContextServer, obj : Mubble.uChildObject<ActiveUserRequest>) {

		rc.isDebug() && rc.debug(rc.getName(this), 'Re-initializing ActiveUserRequest.', this, obj)

		const keys = Object.keys(obj) as Array<keyof ActiveUserRequest>

		for(const key of keys) {
			if (key === 'failedGws') {
				this.failedGws.push(...(obj.failedGws as Array<string>))
				continue
			}
			(this as any)[key] = obj[key]
		}

		return this
	}
}