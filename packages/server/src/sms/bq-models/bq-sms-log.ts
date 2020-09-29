/*------------------------------------------------------------------------------
	 About      : Big query model for logging sms informtion
	 
	 Created on : Tue Mar 03 2020
	 Author     : Vedant Pandey
	 
	 Copyright (c) 2020 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { BqBaseModel, 
				 BqBase 
			 }										 from '../../gcp'
import { RunContextServer }	 from '../../rc-server'

// @BigqueryBase.model('')
export class BQSmsVerificationLog extends BqBaseModel {

	
	// @BigqueryBase.field()
	service	 : string
	
	// @BigqueryBase.field()
	userId	 : string
	
	// @BigqueryBase.field()
	mobNo		 : string
	
	// @BigqueryBase.field()
	tranId	 : string
	
	// @BigqueryBase.field()
	sms			 : string
	
	// @BigqueryBase.field()
	gwTranId : string
	
	// @BigqueryBase.field()
	gw			 : string
	
	// @BigqueryBase.field()
	status	 : string
	
	// @BigqueryBase.field(BigqueryBase.FIELD_TYPE.INTEGER)
	ts			 : number
	
	// @BigqueryBase.field(BigqueryBase.FIELD_TYPE.INTEGER)
	gwSendMs : number
	
	// @BigqueryBase.field(BigqueryBase.FIELD_TYPE.INTEGER)
	gwRespMs : number

	public constructor(rc : RunContextServer) {
		super(rc)
	}

	initModel(rc 			 : RunContextServer,
						service	 : string,
						userId	 : string,
						mobNo		 : string,
						tranId	 : string,
						sms			 : string,
						gwTranId : string,
						gw			 : string,
						status	 : string,
						ts			 : number,
						gwSendMs : number,
						gwRespMs : number) {

		this.service  = service
		this.userId   = userId
		this.mobNo    = mobNo
		this.tranId   = tranId
		this.sms      = sms
		this.gwTranId = gwTranId
		this.gw       = gw
		this.status   = status
		this.ts       = ts
		this.gwSendMs = gwSendMs
		this.gwRespMs = gwRespMs
	}

	public fieldsError(rc : RunContextServer) : string | null {
		return null
	}

}