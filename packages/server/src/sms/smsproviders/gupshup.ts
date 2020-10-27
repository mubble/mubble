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
				 ClientInfo
			 }											from '../sms-interfaces'
import { RunContextServer }		from '../../rc-server'
import { ActiveUserRequest }	from '../request'
import { HttpsRequest }				from '../../util'
import { HTTP } 							from '@mubble/core'
import { UrlObject } 					from 'url'
import * as http							from 'http'

const VERSION 		= '1.1',
			MSG_TYPE   	= 'TEXT',
			AUTH_SCHEME = 'PLAIN'

export class Gupshup extends SmsProviderClient {

	httpsRequest : HttpsRequest

	constructor(rc : RunContextServer, hostname : string, logDirectory : string) {
		super()
		this.httpsRequest = new HttpsRequest(rc, logDirectory, hostname)
	}

	async request<T extends ClientInfo>(rc      : RunContextServer,
																			 request : ActiveUserRequest,
																			 info	 	 : T) : Promise<SmsSendResponse> {

		const gupshupKeys = info.creds as GupshupCredentials

		let mobileNo = request.mobNo,
				message  = request.sms

		rc.isDebug() && rc.debug(rc.getName(this), 'Mobile number : ', mobileNo)
		rc.isDebug() && rc.debug(rc.getName(this), 'SMS : ', message)

		if(mobileNo.includes('+91')) mobileNo = mobileNo.substring(3, 13)

		const urlObj : UrlObject = {
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

		const resp = await this.httpsRequest.executeRequest(rc, urlObj, options)

		return { success : true, gwTranId : resp.response }
	}
}