/*------------------------------------------------------------------------------
   About      : Sms error library
   
   Created on : Tue Mar 03 2020
   Author     : Vedant Pandey
   
   Copyright (c) 2020 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { Mubble } from '@mubble/core'

export enum SmsErrorCodes {
	NOT_INDIAN_MOBILE_NUMBER    = 'NOT_INDIAN_MOBILE_NUMBER',
	SMS_SERVICE_NOT_INITIALIZED = 'SMS_SERVICE_NOT_INITIALIZED',
	NO_ACTIVE_USER_REQUEST      = 'NO_ACTIVE_USER_REQUEST',
	DUPLICATED_REQUEST          = 'DUPLICATED_REQUEST',
	PROVIDER_NOT_AVAILABLE      = 'PROVIDER_NOT_AVAILABLE',
	REQUEST_INFO_MISMATCH       = 'REQUEST_INFO_MISMATCH',
	INVALID_SMS_CONFIG					= 'INVALID_SMS_CONFIG'
}

export enum SmsErrorMessages {
	NOT_INDIAN_MOBILE_NUMBER    = 'The mobile number provided is not Indian, please enter an indian mobile number.',
	SMS_SERVICE_NOT_INITIALIZED = 'Sms service is not initialized.',
	NO_ACTIVE_USER_REQUEST      = 'Some error occured. Please try again later.',
	DUPLICATED_REQUEST          = 'The request made is duplicated. Please wait and try again.',
	PROVIDER_NOT_AVAILABLE      = 'Some error occured. Please try again later.',
	REQUEST_INFO_MISMATCH			  = 'Skipping entry in SMS verification logs due to mismatch.',
  INVALID_SMS_CONFIG        	= 'Invalid server config.',
}

export class SmsError extends Mubble.uError {
	constructor(name : SmsErrorCodes, msg : SmsErrorMessages) {
		super(name, msg)
		Object.setPrototypeOf(this, SmsError.prototype)
	}
}