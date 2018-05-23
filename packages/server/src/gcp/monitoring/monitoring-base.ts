/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Tue Aug 01 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const monitoring : any = require('@google-cloud/monitoring')

import {RunContextServer}           from '../../rc-server'
import {GcloudEnv}                  from '../gcloud-env'
import * as monitoringTypes         from './types'

export class MonitoringBase {

  static _monitoring : any
  static _projectId  : string
  static _active     : boolean

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
    if(gcloudEnv.projectId) {
      this._projectId  = gcloudEnv.projectId
      this._active     = true
    } else {
      this._active = false
    }
  }

  static async sendToMetrics(rc : RunContextServer, metricName : string, count : number) {
    if(!this._active) return 'Trace Disabled'

    const client = MonitoringBase._monitoring.metricServiceClient()
    const endTimeSecs = Date.now() / 1000
    let dataPoint = {
      interval: {
        endTime: {
          seconds: endTimeSecs
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
    try {
      await client.createTimeSeries(request)
      return true
    }
    catch(err) {
      rc.isError() && rc.error(rc.getName(this), `Ignoring Error in Creating Time Series Metric.`, metricName, endTimeSecs, count, err)
      return false
    }
  }

  static async listMetrics(rc : RunContextServer, metricName : string) {
    if(!this._active) return 'Trace Disabled'

    const client = MonitoringBase._monitoring.metricServiceClient()

    const request = {
      name: `projects/${MonitoringBase._projectId}`,
      filter: `metric.type="compute.googleapis.com/${metricName}"`,
      interval: {
        startTime: {
          // Limit results to the last 20 minutes
          seconds: Date.now() / 1000 - 60 * 20,
        },
        endTime: {
          seconds: Date.now() / 1000,
        },
      },
      // Don't return time series data, instead just return information about
      // the metrics that match the filter
      view: 'HEADERS',
    };
    try {
      const timeSeries = await client.listTimeSeries(request)
      rc.isWarn() && rc.warn(rc.getName(this), `Getting Time Series Metric.`, metricName, JSON.stringify (timeSeries))
      return true
    }
    catch(err) {
      rc.isError() && rc.error(rc.getName(this), `Ignoring Error in Listing Time Series Metric.`, metricName, err)
      return false
    }
  }

  static async sendToMetricsBulk(rc : RunContextServer, metricArr : monitoringTypes.metricFormat[]) {
    if(!this._active) return 'Trace Disabled'
    
    const client  = MonitoringBase._monitoring.metricServiceClient(),
          request = {
            name       : `projects/${MonitoringBase._projectId}`,
            timeSeries : [] as any[]
          }
    
    for(const val of metricArr) {
      let dataPoint = {
        interval: {
          endTime: {
            seconds: Date.now() / 1000
          }
        },
        value: {
          int64Value: val.count
        }
      }

      let timeSeriesVal = {// Ties the data point to a custom metric
        metric: {
          type: `custom.googleapis.com/${val.metricName}`,
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

      request.timeSeries.push(timeSeriesVal)
    }

    await client.createTimeSeries(request)
  }

}