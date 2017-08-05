/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Tue Aug 01 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const monitoring : any = require('@google-cloud/monitoring')

import {RunContextServer}           from '../../rc-server'
import {GcloudEnv}                  from '../gcloud-env'

export class MonitoringBase {

  static _monitoring : any
  static _projectId  : string

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                      INITIALIZATION FUNCTION
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */   
  static init(rc : RunContextServer, gcloudEnv : GcloudEnv) {
    if (gcloudEnv.authKey) {
      gcloudEnv.monitoring = monitoring.v3({
        projectId   : gcloudEnv.projectId,
        credentials : gcloudEnv.authKey
      })
    } else {
      gcloudEnv.monitoring = monitoring.v3({
        projectId   : gcloudEnv.projectId
      })
    }

    this._monitoring = gcloudEnv.monitoring
    this._projectId  = gcloudEnv.projectId
  }

  async sendToMetrics(rc : RunContextServer, metricName : string, count : number) {
    const client = MonitoringBase._monitoring.metricServiceClient()

    let dataPoint = {
      interval: {
        endTime: {
          seconds: Date.now() / 1000
        }
      },
      value: {
        int64Value: count
      }
    }
    
    let request = {
      name: `projects/${MonitoringBase._projectId}`,
      timeSeries: [
        {// Ties the data point to a custom metric
          metric: {
            type: `custom.googleapis.com/${metricName}`,
          },
          resource: {
            type: 'global',
            labels: {
              project_id: MonitoringBase._projectId
            }
          },
          points: [
            dataPoint
          ]
        }
      ]
    }

    await client.createTimeSeries(request)
  }

}