/*------------------------------------------------------------------------------
	 About      : ACL - SMS provider to send SMS request.
	 
	 Created on : Mon Mar 26 2018
	 Author     : Vishal Sinha
	 
	 Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {
				 AclCredentials,
				 SmsProviderClient,
				 SmsSendResponse,
				 ClientInfo,
			 }																	from '../sms-interfaces'
import { RunContextServer }								from '../../rc-server'
import { ActiveUserRequest }							from '../request'
import { HttpsRequest }										from '../../util'
import { HTTP } 													from '@mubble/core'
import { SmsConstants } 									from '../sms-constants'
import { UrlObject } 											from 'url'
import * as http													from 'http'

export class Acl extends SmsProviderClient {

	httpsRequest : HttpsRequest

	constructor(rc : RunContextServer, hostname : string, logDirectory : string) {
		super()
		this.httpsRequest = new HttpsRequest(rc, logDirectory, hostname)
	}

	public async request<T extends ClientInfo>(rc      : RunContextServer,
																							request : ActiveUserRequest,
																							info 		: T) : Promise<SmsSendResponse> {

		const aclKeys = info.creds as AclCredentials

		let mobileNo = request.mobNo,
				message  = request.sms

		rc.isDebug() && rc.debug(rc.getName(this), 'Mobile number : ', mobileNo)
		rc.isDebug() && rc.debug(rc.getName(this), 'SMS : ', message)

		if(mobileNo.includes('+91')) mobileNo = mobileNo.substring(3, 13)

		const urlObj : UrlObject = {
			protocol : aclKeys.http ? HTTP.Const.protocolHttp : HTTP.Const.protocolHttps,
			hostname : aclKeys.host,
			port	   : aclKeys.port,
			pathname : aclKeys.path,
			query    : {
				enterpriseId    : aclKeys.enterpriseId,
				subEnterpriseId : aclKeys.subEnterpriseId,
				pusheid         : aclKeys.pushId,
				pushepwd        : aclKeys.pushpwd,
				sender          : aclKeys.sender,
				msisdn          : mobileNo,
				msgtext         : message
			}
		}

		const options : http.RequestOptions = urlObj
		options.method  = HTTP.Method.GET
		options.headers = {[HTTP.HeaderKey.contentType] : HTTP.HeaderValue.json}

		rc.isStatus() && rc.status(rc.getName(this), 'RequestOptions : ', options)

		const resp = await this.httpsRequest.executeRequest(rc, urlObj, options)

		return {success : true, gwTranId : resp.response}
	}
}