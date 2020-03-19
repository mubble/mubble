/*------------------------------------------------------------------------------
	 About      : Route-Mobile - SMS provider to send SMS request.
	 
	 Created on : Thu Oct 24 2019
	 Author     : Vishal Sinha
	 
	 Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import { 
				 SmsProviderClient,
				 SmsSendResponse,
				 RouteMobileCredentials,
				 ClientInfo
			 }																		from '../sms-interfaces'
import { ActiveUserRequest }								from '../request'
import { RunContextServer } 								from '../../rc-server'
import { HttpsRequest } 										from '../../util'
import { SmsConstants } 										from '../sms-constants'
import { HTTP } 														from '@mubble/core'
import * as http 														from 'http'
import * as urlModule												from 'url'

// http://<host>:8080/bulksms/bulksms?username=XXXX&password=YYYYY&type=Y&dlr=Z&destination=QQQQQQQQQ&source=RRRR&message=SSSSSSSS

const PORT = 8080,
			PATH = '/bulksms/bulksms',
			TYPE = 0,
			DLR  = 0

export class RouteMobile extends SmsProviderClient {

	https : HttpsRequest

	constructor(rc : RunContextServer, hostname : string) {
		super()
		this.https = new HttpsRequest(rc, SmsConstants.SMS_LOG_DIR, hostname)
	}

	public async request<T extends ClientInfo>(rc      : RunContextServer,
											 												request : ActiveUserRequest,
											 												info 	: T) : Promise<SmsSendResponse> {

		const RMKeys = info.creds as RouteMobileCredentials,
					urlObj : urlModule.UrlObject = {
						protocol : HTTP.Const.protocolHttp,
						hostname : RMKeys.host,
						port     : PORT,
						pathname : PATH,
						query    : {
							username    : RMKeys.username,
							password    : RMKeys.password,
							type        : TYPE,
							dlr         : DLR,
							destination : request.mobNo,
							source      : RMKeys.source,
							message     : request.sms
						}
					}

		const options : http.RequestOptions = urlObj
		options.method = HTTP.Method.GET

		const resp = await this.https.executeRequest(rc, urlObj, options)

		return { success : true, gwTranId : resp.response }
	}
}