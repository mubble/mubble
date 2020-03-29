/*------------------------------------------------------------------------------
	 About      : Types and definitions used for SMS verification and requests.
	 
	 Created on : Tue Mar 27 2018
	 Author     : Vishal Sinha
	 
	 Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { Acl, 
				 RouteMobile, 
				 Karix, 
				 Gupshup 
			 } 											from './smsproviders'
import { ActiveUserRequest }	from './request'
import { RunContextServer }		from '../rc-server'
import { Mubble }							from '@mubble/core'

export interface SendSmsResponse {
	isIndianNumber           : boolean       // Is the mobile number from India?
	smsSent                  : boolean       // Did provider send the sms?
	smsSendingFailureReason ?: string        // If smsSent === false, why did it fail?
	msTaken                 ?: number        // Milliseconds taken to send the sms
}

export interface SmsProviderConfig {
	PROVIDERS     : Array<Provider>
	PROVIDER_KEYS : ProviderConfigs
}

export interface Provider {
	name     : string
	enabled  : boolean
}

export interface SmsTransactionInfo {
	service 	 		: string
	userId		 		: string
	transactionId : string
	mobileNo	    : string
}

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

export type Credentials = AclCredentials | GupshupCredentials | KarixCredentials | RouteMobileCredentials

export type ProviderConfigs = {
	[key in SmsProvider] ?: Credentials
}

export type ClientMap = {
	[key in SmsProvider] ?: Client
}

export type Client = Acl | Gupshup | Karix | RouteMobile

// export type AclInfo = {
// 	client : Acl
// 	creds : AclCredentials
// }

// export type GupshupInfo = {
// 	client : Gupshup
// 	creds : GupshupCredentials
// }

// export type KarixInfo = {
// 	client : Karix
// 	creds : KarixCredentials
// }

// export type RouteMobileInfo = {
// 	client : RouteMobile
// 	creds : RouteMobileCredentials
// }

export type ClientInfo = {
	client : Client
	creds  : Credentials
}

export abstract class SmsProviderClient {

	abstract async request<T extends ClientInfo>(rc      : RunContextServer,
																							 request : ActiveUserRequest,
																							 info 	 : T) : Promise<SmsSendResponse>

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