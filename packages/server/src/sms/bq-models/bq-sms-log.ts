/*------------------------------------------------------------------------------
	 About      : Big query model for logging sms informtion
	 
	 Created on : Tue Mar 03 2020
	 Author     : Vedant Pandey
	 
	 Copyright (c) 2020 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { BigQueryBaseModel }		from '../../gcp'
import { RunContextServer }			from '../../rc-server'
import { SmsVerficationLog }		from '../sms-interfaces'
import * as lo									from 'lodash'

const table_options = {
	schema : {
		fields : [
			{ name : 'service',  type : 'STRING',    mode : 'NULLABLE' },
			{ name : 'userId',   type : 'STRING',    mode : 'REQUIRED' },
			{ name : 'mobNo',    type : 'STRING',    mode : 'NULLABLE' },
			{ name : 'tranId',   type : 'STRING',    mode : 'NULLABLE' },
			{ name : 'otp',      type : 'INTEGER',   mode : 'NULLABLE' },
			{ name : 'sms',      type : 'STRING',    mode : 'NULLABLE' },
			{ name : 'ts',       type : 'TIMESTAMP', mode : 'NULLABLE' },
			{ name : 'gwTranId', type : 'STRING',    mode : 'NULLABLE' },
			{ name : 'gw',       type : 'STRING',    mode : 'NULLABLE' },
			{ name : 'gwSendMs', type : 'INTEGER',   mode : 'NULLABLE' },
			{ name : 'gwRespMs', type : 'INTEGER',   mode : 'NULLABLE' },
			{ name : 'service',  type : 'STRING',    mode : 'NULLABLE' }
		]
	}
}

// TODO (Vedant) : Shift to new bq model - Discuss with Sid and Suman for kt

export class BQSmsVerificationLog extends BigQueryBaseModel {

	public fieldsError(rc : RunContextServer) : string | null {
		return null
	}

	// protected static options : BigQueryTableOptions = {
	// 	_tableName      : 'sms_verification_logs',
	// 	DATA_STORE_NAME : '',
	// 	table_options   : table_options,
	// 	day_partition   : true
	// }

	// public static getOptions() : BigQueryTableOptions {
	// 	return lo.clone(this.options)
	// }

	service  : string = null as any
	userId   : string = null as any
	mobNo    : string = null as any
	tranId   : string = null as any
	otp      : number = null as any
	sms      : string = null as any
	ts       : number = null as any
	gwTranId : string = null as any
	gw       : string = null as any
	gwSendMs : number = null as any
	gwRespMs : number = null as any
	status   : string = null as any

	public constructor(rc : RunContextServer, smsLog : SmsVerficationLog) {
		super(rc)
		this.copyConstruct(smsLog)
	}

	public static async insertBQItems(rc : RunContextServer, bqArr : Array<BQSmsVerificationLog>) {
		for(const bqItem of bqArr) {
			await bqItem.insert(rc)
		}
	}
}