/*------------------------------------------------------------------------------
	 About      : ACL - SMS provider to send SMS request.
	 
	 Created on : Mon Mar 26 2018
	 Author     : Vishal Sinha
	 
	 Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {
				 AclCredentials,
				 SmsProviderClient,
				 SmsSendResponse
			 }																	from '../sms-interfaces'
import { RunContextServer }								from '../../rc-server'
import { ActiveUserRequest }							from '../request'
import { executeHttpsRequestWithOptions }	from '../../util'
import { HTTP } 													from '@mubble/core'
import { UrlObject } 											from 'url'
import { RequestOptions }									from 'http'

export class Acl extends SmsProviderClient {

	public async request(rc      : RunContextServer,
											 request : ActiveUserRequest,
											 aclKeys : AclCredentials) : Promise<SmsSendResponse> {

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

		const options : RequestOptions = urlObj
		options.method = HTTP.Method.GET

		rc.isStatus() && rc.status(rc.getName(this), 'RequestOptions : ', options)

		const resp = await executeHttpsRequestWithOptions(rc, urlObj, options)

		// if(resp.error) return {success : false, gwTranId : resp.data}
		return {success : true, gwTranId : resp.response}
	}
}