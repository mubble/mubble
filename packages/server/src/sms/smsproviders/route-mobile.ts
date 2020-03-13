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
				 SMS_LOG_DIR
			 }																		from '../sms-interfaces'
import { ActiveUserRequest }								from '../request'
import { HTTP } 														from '@mubble/core'
import { RunContextServer } 								from '../../rc-server'
import { HttpsRequest } 										from '../../util'
import * as http 														from 'http'
import * as urlModule												from 'url'

// http://<host>:8080/bulksms/bulksms?username=XXXX&password=YYYYY&type=Y&dlr=Z&destination=QQQQQQQQQ&source=RRRR&message=SSSSSSSS

const PORT = 8080,
			PATH = '/bulksms/bulksms',
			TYPE = 0,
			DLR  = 0

export class RouteMobile extends SmsProviderClient {

	public async request(rc          : RunContextServer,
											 request     : ActiveUserRequest,
											 credentials : RouteMobileCredentials) : Promise<SmsSendResponse> {

		const https = new HttpsRequest(rc, SMS_LOG_DIR, credentials.host),
					urlObj : urlModule.UrlObject = {
						protocol : HTTP.Const.protocolHttp,
						hostname : credentials.host,
						port     : PORT,
						pathname : PATH,
						query    : {
							username    : credentials.username,
							password    : credentials.password,
							type        : TYPE,
							dlr         : DLR,
							destination : request.mobNo,
							source      : credentials.source,
							message     : request.sms
						}
					}

		const options : http.RequestOptions = urlObj
		options.method = HTTP.Method.GET

		const resp = await https.executeRequest(rc, urlObj, options)

		return { success : true, gwTranId : resp.response }
	}
}