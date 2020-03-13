/*------------------------------------------------------------------------------
	 About      : Types and definitions used for SMS verification and requests.
	 
	 Created on : Tue Mar 27 2018
	 Author     : Vishal Sinha
	 
	 Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { ActiveUserRequest }	from './request'
import { RunContextServer }		from '../rc-server'
import { Mubble }							from '@mubble/core'

export const SMS_LOG_DIR = '../sms-logs'

export interface SendSmsResponse {
	isIndianNumber           : boolean       // Is the mobile number from India?
	smsSent                  : boolean       // Did provider send the sms?
	smsSendingFailureReason ?: string        // If smsSent === false, why did it fail?
	msTaken                 ?: number        // Milliseconds taken to send the sms
}

export interface SmsProviderConfig {
	PROVIDERS     : Array<Provider>
	SMS_TEMPLATE  : SmsTemplate
	PROVIDER_KEYS : Mubble.uObject<any>
}

export interface Provider {
	name         : string
	enabled      : boolean
}

export interface SmsTransactionInfo {
	service 	 		: string
	userId		 		: string
	transactionId : string
	mobileNo	    : string
}

export type SmsTemplate = Mubble.uObject<string>

export interface SmsVerficationLog { // Stores ActiveUserRequest data, used for logging in BigQuery
	service  : string
	userId   : string
	mobNo    : string
	tranId   : string
	sms      : string
	ts       : number
	gwTranId : string
	gw       : string
	gwSendMs : number
	gwRespMs : number
	status   : string
}

/*------------------------------------------------------------------------------
	SMS Provider Configs
------------------------------------------------------------------------------*/


export enum SmsProvider {
	ACL          = 'ACL',
	GUPSHUP      = 'GUPSHUP',
	KARIX        = 'KARIX',
	ROUTE_MOBILE = 'ROUTE_MOBILE'
}

export abstract class SmsProviderClient {

	abstract async request(rc          : RunContextServer,
												 request     : ActiveUserRequest,
												 credentials : any) : Promise<SmsSendResponse>

}

export interface SmsSendResponse {
	success  : boolean                  // Was provider able to send the sms request?
	gwTranId : string                   // Gateway Transaction Id
}

export interface GupshupCredentials {
	http		 : boolean
	host		 : string
	port		 : number
	path		 : string
	userId   : number
	password : string
}

export interface AclCredentials {
	http		 				: boolean
	port						: number
	host						: string
	path						: string
	enterpriseId    : string
	subEnterpriseId : string
	pushId          : string
	pushpwd         : string
	sender          : string
}

export interface KarixCredentials {
	http             : boolean
	host             : string
	port            ?: number
	path            ?: string
	classId          : string
	applicationType  : string
	carrierId        : string
	smsPort          : string
}

export interface RouteMobileCredentials {
	host     : string
	port     : number
	username : string
	password : string
	source   : string
}