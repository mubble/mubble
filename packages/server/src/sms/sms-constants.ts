/*------------------------------------------------------------------------------
   About      : Constants used across sms module
   
   Created on : Fri Mar 06 2020
   Author     : Vedant Pandey
   
   Copyright (c) 2020 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

export namespace SmsConstants {
	export const RX_INDIAN_MOBILE 			: RegExp = /^\+91[6789]\d{9}$/,
							 PROVIDER_SEND_FAILURE : string = 'PROVIDER_SEND_FAILURE',
							 // suffixed by PROVIDER_CODE making key keeping contiguous failure counts
							 REDIS_PROVIDER_DOWN				= 'smsgw:down:',
							 // suffixed by PROVIDER_CODE and hh:mm making key keeping scores at provider level
							 // smsgw:score:GUPSHUP:hh:mm
							 REDIS_PROVIDER_HHMM_SCORE	= 'smsgw:score:',
							 // suffixed by PROVIDER_CODE and hh:mm to update scores with a lock
							 // smsgw:lock:GUPSHUP:hh:mm
							 REDIS_PROVIDER_HHMM_LOCK	= 'smsgw:lock:',
							 // Default seperator
							 REDIS_SEP									= ':',
				 
							 REDIS_DOWN_EXPIRY_MS			= 10 * 60 * 1000,				// 10 minutes
							 REDIS_SCORE_EXPIRY_MS			= 13 * 60 * 60 * 1000,	// 13 hours
							 HIGHEST_WEIGHTAGE					= 24,										// For current scores
							 LOWEST_WEIGHTAGE					= 0,										// For 12 hours ago scores
							 TOTAL_WEIGHTAGE						= 300,									// 0 + 1 + 2 + .. + 24
							 TWELVE_HOUR_MS						= 12 * 60 * 60 * 1000,	// 12 hours
							 THIRTY_MINUTE_MS					= 30 * 60 * 1000, 			// 30 minutes
							 SCORE_LOCK_MS							= 30 * 1000, 						// 30 seconds
							 MAX_GW_FAIL_COUNT					= 5											// Max fail counts acceptable
}
