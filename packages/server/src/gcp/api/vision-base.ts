/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Thu Jun 01 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const gVision : any = require('@google-cloud/vision')

import {RunContextServer} from '../../rc-server'
import {GcloudEnv}        from '../gcloud-env'

export class VisionBase {

  _vision : any

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                      INITIALIZATION FUNCTION
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */   
  static init(rc : RunContextServer, gcloudEnv : GcloudEnv) {
    if (gcloudEnv.authKey) {
      gcloudEnv.vision = gVision ({
        projectId   : gcloudEnv.projectId,
        credentials : gcloudEnv.authKey
      })
    } else {
      gcloudEnv.cloudStorage = gVision ({
        projectId   : gcloudEnv.projectId
      })
    }
  }

  constructor(rc : RunContextServer, gcloudEnv : GcloudEnv) {
    this._vision = gcloudEnv.cloudStorage
  }

  async detectCrops(rc : RunContextServer,imagePath : string) : Promise<string> {
    //Image path can be a local path or a URL
    return await this._vision.detectCrops(imagePath)
  }
}