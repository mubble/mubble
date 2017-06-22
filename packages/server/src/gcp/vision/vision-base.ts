/*------------------------------------------------------------------------------
   About      : Google vision access
   
   Created on : Thu Jun 01 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const gVision : any = require('@google-cloud/vision')

import {RunContextServer}           from '../../rc-server'
import {GcloudEnv}                  from '../gcloud-env'
import * as jimp                    from 'jimp'

export class VisionBase {

  static _vision : any

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
      gcloudEnv.vision = gVision ({
        projectId   : gcloudEnv.projectId
      })
    }

    this._vision = gcloudEnv.vision
  }

  static async detectCrops(rc : RunContextServer, imagePath : string, ratio : number) : Promise<string> {
    //Image path can be a local path or a URL
    return VisionBase._vision.detectCrops(imagePath, 
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

  static async processToBase64(rc : RunContextServer, imagePath : string, ratio ?: number, shrink ?: {h: number, w: number}) 
  : Promise<{data : string, mime: string | false, height : number, width : number}> {
    //Image path can be a local path or a URL
    const crops  : any  = await VisionBase.detectCrops(rc, imagePath, ratio || 1.78),
          image  : any  = await jimp.read(imagePath)

    let height : number,
        width  : number

    if(crops && crops.length && crops[0].bounds) {
      const b = crops[0].bounds,
            x = b[0].x,
            y = b[0].y
      
      width  = b[1].x - b[0].x
      height = b[3].y - b[0].y,
      
      await image.crop( x, y, width, height)
      if(shrink) image.resize(shrink.w, shrink.h)
    }

    return new Promise<{data : string, mime: string | false, height : number, width : number}>((resolve, reject) => {
        image.getBuffer(image.getMIME(), (err : any, res : any) => {
          if(err) return reject(err)
          const base64 = res.toString('base64')

          return resolve({data   : base64, 
                          mime   : image.getMIME(),
                          height : (shrink) ? shrink.h : height,
                          width  : (shrink) ? shrink.w : width
                        })
        })
      })
  }

  static async processToBinary(rc : RunContextServer, imagePath : string, ratio ?: number, shrink ?: {h: number, w: number}) 
  : Promise<{data : string, mime: string | false, height : number, width : number}>{
    //Image path can be a local path or a URL
    const crops  : any  = await VisionBase.detectCrops(rc, imagePath, ratio || 1.78),
          image  : any  = await jimp.read(imagePath)
    
    let height : number,
        width  : number

    if(crops && crops.length && crops[0][0].bounds) {
      const b = crops[0][0].bounds,
            x = b[0].x,
            y = b[0].y
      
      width  = b[1].x - b[0].x
      height = b[3].y - b[0].y,
      
      await image.crop( x, y, width, height)
      if(shrink) image.resize(shrink.w, shrink.h)
    }
    return new Promise<{data : string, mime: string | false, height : number, width : number}>((resolve, reject) => {
        image.getBuffer(image.getMIME(), (err : any, res : any) => {
          if(err) return reject(err)

          return resolve({data   : res, 
                          mime   : image.getMIME(),
                          height : (shrink) ? shrink.h : height,
                          width  : (shrink) ? shrink.w : width
                        })
        })
      })
  }
}