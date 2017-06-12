/*------------------------------------------------------------------------------
   About      : Google vision access
   
   Created on : Thu Jun 01 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const gVision : any = require('@google-cloud/vision')

import {RunContextServer} from '../../rc-server'
import {GcloudEnv}        from '../gcloud-env'
import * as jimp          from 'jimp'

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
    this._vision = gcloudEnv.vision
  }

  async detectCrops(rc : RunContextServer, imagePath : string, ratio : number) : Promise<string> {
    //Image path can be a local path or a URL
    return await this._vision.detectCrops(imagePath, 
          // PARAMS 
          { 
            verbose : true, 
            imageContext : {
                cropHintsParams : {
                  aspectRatios : [ratio]
                }
            }
          })
  }

  async processToBase64(rc : RunContextServer, imagePath : string, ratio ?: number, shrink ?: {h: number, w: number}) {
    //Image path can be a local path or a URL
    const crops  : any  = await this.detectCrops(rc, imagePath, ratio || 1.78),
          image  : any  = await jimp.read(imagePath)

    if(crops && crops.length && crops[0].bounds) {
      const b = crops[0].bounds,
            x = b[0].x,
            y = b[0].y,
            h = b[3].y - b[0].y,
            w = b[1].x - b[0].x
      
      image.crop( x, y, w, h)
      if(shrink) image.resize(shrink.w, shrink.h)
      
      return new Promise((resolve, reject) => {
        image.getBase64(image.getMIME(), (err : any, res : any) => {
          if(err) return reject(err)
          return resolve({data : res, mime : image.getMIME()})
        })
      })
    }
    return new Promise((resolve, reject) => {
        image.getBase64(image.getMIME(), (err : any, res : any) => {
          if(err) return reject(err)
          return resolve({data : res, mime : image.getMIME()})
        })
      })
  }

  async processToBinary(rc : RunContextServer, imagePath : string, ratio ?: number, shrink ?: {h: number, w: number}) {
    //Image path can be a local path or a URL
    const crops  : any  = await this.detectCrops(rc, imagePath, ratio || 1.78),
          image  : any  = await jimp.read(imagePath)

    if(crops && crops.length && crops[0].bounds) {
      const b = crops[0].bounds,
            x = b[0].x,
            y = b[0].y,
            h = b[3].y - b[0].y,
            w = b[1].x - b[0].x
      
      image.crop( x, y, w, h)
      if(shrink) image.resize(shrink.w, shrink.h)
      
      return new Promise((resolve, reject) => {
        image.getBuffer(image.getMIME(), (err : any, res : any) => {
          if(err) return reject(err)
          return resolve({data : res, mime : image.getMIME()})
        })
      })
    }
    return new Promise((resolve, reject) => {
        image.getBuffer(image.getMIME(), (err : any, res : any) => {
          if(err) return reject(err)
          return resolve({data : res, mime : image.getMIME()})
        })
      })
  }
}