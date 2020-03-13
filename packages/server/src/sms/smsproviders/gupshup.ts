/*------------------------------------------------------------------------------
	 About      : GupShup - SMS provider to send SMS request.
	 
	 Created on : Mon Mar 26 2018
	 Author     : Vishal Sinha
	 
	 Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { 
				 GupshupCredentials,
				 SmsProviderClient,
				 SmsSendResponse,
				 SMS_LOG_DIR
			 }                              		 from '../sms-interfaces'
import { RunContextServer }           		 from '../../rc-server'
import { ActiveUserRequest }          		 from '../request'
import { HttpsRequest }										 from '../../util'
import { UrlObject } 											 from 'url'
import { HTTP } 													 from '@mubble/core'
import * as http													 from 'http'

const VERSION 		= '1.1',
			MSG_TYPE   	= 'TEXT',
			AUTH_SCHEME = 'PLAIN'

export class GupShup extends SmsProviderClient {

	async request(rc          : RunContextServer,
								request     : ActiveUserRequest,
								gupshupKeys : GupshupCredentials) : Promise<SmsSendResponse> {

		let mobileNo = request.mobNo,
				message  = request.sms

		rc.isDebug() && rc.debug(rc.getName(this), 'Mobile number : ', mobileNo)
		rc.isDebug() && rc.debug(rc.getName(this), 'SMS : ', message)

		if(mobileNo.includes('+91')) mobileNo = mobileNo.substring(3, 13)

		const https = new HttpsRequest(rc, SMS_LOG_DIR, gupshupKeys.host),
					urlObj : UrlObject = {
						protocol : gupshupKeys.http ? HTTP.Const.protocolHttp : HTTP.Const.protocolHttps,
						hostname : gupshupKeys.host,
						port     : gupshupKeys.port,
						pathname : gupshupKeys.path,
						query    : {
							userId       : gupshupKeys.userId,
							password     : encodeURIComponent(gupshupKeys.password),
							msg          : message,
							send_to      : encodeURIComponent(mobileNo),
							v            : VERSION,
							msg_type     : MSG_TYPE,
							auth_scheme  : AUTH_SCHEME,
							override_dnd : true
						}
					}

		const options : http.RequestOptions = urlObj
		options.method  = HTTP.Method.GET
		options.headers = {[HTTP.HeaderKey.contentType] : HTTP.HeaderValue.json}

		rc.isDebug() && rc.debug(rc.getName(this), 'UrlObj :', urlObj, 'Options :', options)

		const resp = await https.executeRequest(rc, urlObj, options)

		return { success : true, gwTranId : resp.response }
	}
}