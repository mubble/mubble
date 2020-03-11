/*------------------------------------------------------------------------------
   About      : Karix - SMS provider to send SMS request.
   
   Created on : Mon Sep 23 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import { 
         SmsProviderClient,
         SmsSendResponse,
         KarixCredentials
       }																		from '../sms-interfaces'
import { HTTP } 														from '@mubble/core'
import * as http 														from 'http'
import * as urlModule												from 'url'
import * as qs 															from 'querystring'
import { RunContextServer }									from '../../rc-server'
import { ActiveUserRequest }								from '../request'
import { executeHttpsRequestWithOptions }		from '../../util'

export class Karix extends SmsProviderClient {

	public async request(rc					 : RunContextServer,
											 request 		 : ActiveUserRequest,
											 credentials : KarixCredentials) : Promise<SmsSendResponse> {

		const urlObj : urlModule.UrlObject = {
			protocol : credentials.http ? HTTP.Const.protocolHttp : HTTP.Const.protocolHttps,
			hostname : credentials.host,
			port     : credentials.port,
			pathname : credentials.path
		}

		const query = {
			targetDeviceId : request.mobNo,
			message        : request.sms,
			messageData    : '',
			smsPort        : credentials.smsPort,
			class_id       : credentials.classId,
			carrier_id     : credentials.carrierId,
			appType        : credentials.applicationType				
		}

		const options : http.RequestOptions = urlObj

		options.method  = HTTP.Method.POST
		options.headers = { [HTTP.HeaderKey.contentType] : HTTP.HeaderValue.form }

		const resp = await executeHttpsRequestWithOptions(rc, urlObj, options, qs.stringify(query))

		return { success : true, gwTranId : resp.response }
  }
}