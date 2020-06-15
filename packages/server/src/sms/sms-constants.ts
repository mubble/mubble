/*------------------------------------------------------------------------------
   About      : Constants used across sms module
   
   Created on : Fri Mar 06 2020
   Author     : Vedant Pandey
   
   Copyright (c) 2020 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

export namespace SmsConstants {
	export const RX_INDIAN_MOBILE 			: RegExp = /^\+91[6789]\d{9}$/,

							 PROVIDER_SEND_FAILURE 		 = 'PROVIDER_SEND_FAILURE',
							 REDIS_PROVIDER_DOWN			 = 'smsgw:down:',  // suffixed by gw name making key keeping contiguous failure counts
							 REDIS_PROVIDER_HHMM_SCORE = 'smsgw:score:', // suffixed by gw name and hh:mm making key keeping scores at provider level
							 REDIS_PROVIDER_HHMM_LOCK	 = 'smsgw:lock:',  // suffixed by gw name and hh:mm to update scores with a lock
							 REDIS_SEP								 = ':', 				 	 // Default seperator
				 
							 REDIS_DOWN_EXPIRY_MS			 = 10 * 60 * 1000,			// 10 minutes
							 REDIS_SCORE_EXPIRY_MS		 = 13 * 60 * 60 * 1000,	// 13 hours
							 HIGHEST_WEIGHTAGE				 = 24,									// For current scores
							 LOWEST_WEIGHTAGE					 = 0,										// For 12 hours ago scores
							 TOTAL_WEIGHTAGE					 = 300,									// 0 + 1 + 2 + .. + 24
							 TWELVE_HOUR_MS						 = 12 * 60 * 60 * 1000,	// 12 hours
							 THIRTY_MINUTE_MS					 = 30 * 60 * 1000, 			// 30 minutes
							 SCORE_LOCK_MS						 = 30 * 1000, 					// 30 seconds
							 MAX_GW_FAIL_COUNT				 = 5,										// Max fail counts acceptable
							 SMS_LOGGER_MS 						 = 10 * 60 * 1000, 			// Sms send results will be logged every 10 minutes
							 
							 TREDIS_USER_REQUEST  		 = 'smsuser:user:request', // Ongoing user request. It is hash of service | userId and value is JSON of ActiveUserRequest.
							 // Set to keep all the ongoing user requests. It is an ordered set with score as ts when request was made and member as userId.
							 TREDIS_USER_SET					 = 'smsuser:user:set',
							 // Results of SMS dispatched. When ever client acknowledges, the result is captured in this list.
							 TREDIS_SMS_VERIFICATION_LOGS = 'smsuser:verification:logs',
							 // 10 minutes
							 LATEST_RECORDS_MS				 = 10 * 60 * 1000,
							 // Number of SMS data to be inserted in big-query in one iteration
							 MAX_SMS_PER_ITERATION				 = 50,

							 // Verification result
							 VERIFICATION_SUCCESS			 = 'SUCCESS',
							 VERIFICATION_FAILED 			 = 'FAILED',
							 VERIFICATION_UNKNOWN			 = 'UNKNOWN',
							 // Other constants
							 PIPE_SEPARATOR						 = ' | '
}
