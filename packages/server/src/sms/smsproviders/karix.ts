/*------------------------------------------------------------------------------
   About      : Karix - SMS provider to send SMS request.
   
   Created on : Mon Sep 23 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import { 
         SmsProviderClient,
         SmsSendResponse,
         KarixCredentials,
				 ClientInfo
       }																		from '../sms-interfaces'
import { HTTP } 														from '@mubble/core'
import { RunContextServer }									from '../../rc-server'
import { ActiveUserRequest }								from '../request'
import { HttpsRequest }											from '../../util'
import { SmsConstants } 										from '../sms-constants'
import * as http 														from 'http'
import * as urlModule												from 'url'
import * as qs 															from 'querystring'

export class Karix extends SmsProviderClient {

	httpsRequest : HttpsRequest

	constructor(rc : RunContextServer, hostname : string, logDirectory : string) {
		super()
		this.httpsRequest = new HttpsRequest(rc, logDirectory, hostname)
	}

	public async request<T extends ClientInfo>(rc			: RunContextServer,
											 												request : ActiveUserRequest,
											 												info 		: T) : Promise<SmsSendResponse> {

		const karixKeys = info.creds as KarixCredentials,
					urlObj : urlModule.UrlObject = {
						protocol : karixKeys.http ? HTTP.Const.protocolHttp : HTTP.Const.protocolHttps,
						hostname : karixKeys.host,
						port     : karixKeys.port,
						pathname : karixKeys.path
					},
					query = {
						targetDeviceId : request.mobNo,
						message        : request.sms,
						messageData    : '',
						smsPort        : karixKeys.smsPort,
						class_id       : karixKeys.classId,
						carrier_id     : karixKeys.carrierId,
						appType        : karixKeys.applicationType				
					}

		const options : http.RequestOptions = urlObj

		options.method  = HTTP.Method.POST
		options.headers = { [HTTP.HeaderKey.contentType] : HTTP.HeaderValue.form }

		const resp = await this.httpsRequest.executeRequest(rc, urlObj, options, qs.stringify(query))

		return { success : true, gwTranId : resp.response }
  }
}