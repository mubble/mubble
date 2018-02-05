/*------------------------------------------------------------------------------
   About      : Google Maps APIs
   
   Created on : Mon Feb 05 2018
   Author     : Akash Dathan
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {RunContextServer}                        from '../../rc-server'
import {executeHttpsRequest}                     from '../../util/https-request'

export abstract class BaseMaps {

  abstract getKey(rc : RunContextServer) : string

  async geoCode(rc : RunContextServer, address : string) {
    const query = `json?address=${address}`
    return this.processQuery(rc, query)
  }

  async reverseGeoCode(rc : RunContextServer, latitude : number, longitude : number) {
    const query = `json?latlng=${latitude},${longitude}`
    return this.processQuery(rc, query)
  }

  async processQuery(rc : RunContextServer, query : string) {
    const key = this.getKey(rc)
    if(!key) throw('rc.ENV.GCP.KEY Not Defined')

    const url      = `https://maps.googleapis.com/maps/api/geocode/${query}&key=${key}`,
          response = await executeHttpsRequest(rc, url),
          data     = JSON.parse(response)
        
    rc.isDebug() && rc.debug(rc.getName(this), 'GetLocation ', data)
    return data
  }
}