/*------------------------------------------------------------------------------
   About      : Google vision access
   
   Created on : Thu Jun 01 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const gVision    : any = require('@google-cloud/vision'),
      ColorThief : any = require('color-thief')

import {
        VISION_ERROR_CODES,
        VisionError
       }                            from './error-codes'
import {
        CloudStorageBase,
        GcsUUIDFileInfo
       }                            from '../cloudstorage/cloudstorage-base'
import {
        VisionParameters,
        ProcessedReturn,
        ProcessOptions,
        ProcessGcsReturn
       }                            from './types'
import {RunContextServer}           from '../../rc-server'
import {executeHttpsRequest}        from '../../util/https-request'
import {GcloudEnv}                  from '../gcloud-env'
import * as request                 from 'request' 
import * as fs                      from 'fs'
import * as uuid                    from 'uuid/v4'
import * as gm                      from 'gm'
import * as mime                    from 'mime-types'

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

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                                FUNCTIONS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */  
  static async processData(rc           : RunContextServer, 
                           imageData    : Buffer,
                           imageOptions : VisionParameters,
                           resBase64    : boolean) : Promise<ProcessedReturn> {

    const crops : any = imageOptions.ratio
                        ? await VisionBase.detectCrops(rc, imageOptions.ratio, '', imageData) 
                        : null

    const processOptions = {
            quality      : imageOptions.quality,
            shrink       : imageOptions.shrink,
            crops        : crops,
            returnBase64 : resBase64
          } as ProcessOptions
          
    return VisionBase.process(rc, imageData, processOptions)
  }

static async processUrl(rc           : RunContextServer, 
                        imageUrl     : string,
                        imageOptions : VisionParameters,
                        resBase64    : boolean) : Promise<ProcessedReturn> {
    
    const imageData      : Buffer = new Buffer(await executeHttpsRequest(rc, imageUrl, {'User-Agent': 'Newschat/1.0'}), 'binary'),
          crops          : any    = imageOptions.ratio ? await VisionBase.detectCrops(rc, imageOptions.ratio, imageUrl) : null,
          processOptions          = {
            quality      : imageOptions.quality,
            shrink       : imageOptions.shrink,
            crops        : crops,
            returnBase64 : resBase64
          } as ProcessOptions 

    return VisionBase.process(rc, imageData, processOptions)
  }

  static async processDataToGcs(rc           : RunContextServer, 
                                imageData    : Buffer,
                                imageOptions : VisionParameters,
                                fileInfo     : GcsUUIDFileInfo) : Promise<ProcessGcsReturn> {
    
    rc.isDebug() && rc.debug(rc.getName(this), `Detecting Crops: Image Data: ${imageData.length} bytes`)
    const crops : any = imageOptions.ratio
                        ? await VisionBase.detectCrops(rc, imageOptions.ratio, '', imageData) 
                        : null

    rc.isDebug() && rc.debug(rc.getName(this), `Crops Detected, Crop Size: ${JSON.stringify(imageOptions)}`)
    const processOptions = {
            quality      : imageOptions.quality,
            shrink       : imageOptions.shrink,
            crops        : crops,
            returnBase64 : false
          } as ProcessOptions
    
    return VisionBase.processAndUpload(rc, imageData, processOptions, fileInfo)
}

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                            INTERNAL FUNCTIONS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */  
  private static async detectCrops(rc : RunContextServer, ratio : number, imagePath ?: string, data ?: Buffer) : Promise<string> {
    const sourceVal : any = {},
          features  : any = [{
            type        : gVision.types.Feature.Type.CROP_HINTS
            // maxResults  : 1,
          }],
          imageContext    = {
            cropHintsParams : {
              aspectRatios : [ratio]
            }
          }

    if(data) sourceVal.content = data
    else sourceVal.source = {imageUri : imagePath}

    try {
      const res = await VisionBase._vision.annotateImage({image : sourceVal, features, imageContext})

      if(res[0].error) throw(res[0].error)
      return res[0].cropHintsAnnotation.cropHints[0].boundingPoly.vertices
    } catch(error) {
      throw(new VisionError(VISION_ERROR_CODES.CROP_DETECTION_FAILED, `Crop detection failed : ${JSON.stringify(error)}`))
    } 
  }

  private static async process(rc : RunContextServer, imageData : Buffer, options : ProcessOptions) {
    let height : number  = 0,
        width  : number  = 0

    const gmImage = await gm(imageData)
    
    if(options.crops && options.crops.length) {
      const crops  = options.crops,
            x      = crops[0].x,
            y      = crops[0].y

      width  = crops[1].x - crops[0].x
      height = crops[3].y - crops[0].y

      gmImage.crop(width, height, x, y)
    }

    if(options.shrink)  gmImage.resize(options.shrink.w, options.shrink.h)
    if(options.quality) gmImage.quality(options.quality)

    return {
      data          : options.returnBase64 ? (await this.getGmBuffer(gmImage)).toString('base64') : await this.getGmBuffer(gmImage), 
      mime          : await this.getGmMime(gmImage),
      height        : (options.shrink) ? options.shrink.h : height,
      width         : (options.shrink) ? options.shrink.w : width,
      palette       : this.getPalette(imageData),
      dominantColor : this.getDominantColor(imageData)
    }
  }

  private static async processAndUpload(rc : RunContextServer, imageData : Buffer, options : ProcessOptions, fileInfo : GcsUUIDFileInfo) {
    const gmImage = await gm(imageData),
          retVal  = {} as ProcessGcsReturn,
          mime    = await this.getGmMime(gmImage)
    
    fileInfo.mimeVal     = mime
    retVal.mime          = mime
    retVal.palette       = this.getPalette(imageData)
    retVal.dominantColor = this.getDominantColor(imageData)

    if(options.crops && options.crops.length) {
      const crops  = options.crops,
            x      = crops[0].x,
            y      = crops[0].y,
            width  = crops[1].x - crops[0].x,
            height = crops[3].y - crops[0].y

      gmImage.crop(width, height, x, y)
      retVal.height = (options.shrink) ? options.shrink.h : height
      retVal.width  = (options.shrink) ? options.shrink.w : width
    }

    if(options.shrink)  gmImage.resize(options.shrink.w, options.shrink.h)
    if(options.quality) gmImage.quality(options.quality)

    retVal.url = await CloudStorageBase.uploadDataToCloudStorage(rc, gmImage.stream(), fileInfo)

    return retVal
  }

  private static getGmBuffer(gmImage : any) : Promise<Buffer> {
    return new Promise((resolve, reject) => {
      gmImage.toBuffer((error : any, buffer : any) => {
        if(error) throw(new VisionError(VISION_ERROR_CODES.IMAGE_PROCESSING_FAILED, `GM Image Processing Filed[getGmBuffer] : ${JSON.stringify(error)}`))
        resolve(buffer)
      })
    })
  }

  private static getGmMime(gmImage : any) : Promise<string> {
    return new Promise((resolve, reject) => {
      gmImage.format((error : any, data : any) => {
        if(error) throw(new VisionError(VISION_ERROR_CODES.IMAGE_PROCESSING_FAILED, `GM Image Processing Filed[getGmMime] : ${JSON.stringify(error)}`))
        resolve(mime.lookup(data) || '')
      })
    })
  }

  private static getPalette(image : Buffer) {
    const colorThief = new ColorThief(),
          palette    = colorThief.getPalette(image, 3),
          retval     = []

    for(const val of palette) 
      retval.push({r : val[0], g : val[1], b : val[2]})

    return retval
  }

  private static getDominantColor(image : Buffer) {
    const colorThief    = new ColorThief(),
          dominantColor = colorThief.getColor(image)

    return {
      r : dominantColor[0],
      g : dominantColor[1],
      b : dominantColor[2]
    }
  }
}