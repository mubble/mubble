/*------------------------------------------------------------------------------
   About      : Google vision access
   
   Created on : Thu Jun 01 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const gVision    : any = require('@google-cloud/vision'),
      colorThief : any = require('color-thief-jimp')

import jimp = require('jimp')

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
import * as images                  from 'images'
import * as uuid                    from 'uuid/v4'

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

    const crops : any = (imageOptions.ratio)
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
    
    rc.isDebug() && rc.debug(rc.getName(this), `Processing Data to GCS`)
    const retVal      = {} as ProcessGcsReturn,
          crops : any = (imageOptions.ratio && imageOptions.ratio !== 1)
                        ? await VisionBase.detectCrops(rc, imageOptions.ratio, '', imageData) 
                        : null

    rc.isDebug() && rc.debug(rc.getName(this), `Crops Detected`)
    const processOptions = {
            quality      : imageOptions.quality,
            shrink       : imageOptions.shrink,
            crops        : crops,
            returnBase64 : false
          } as ProcessOptions
    
    const vRes = await VisionBase.process(rc, imageData, processOptions) as ProcessedReturn
        
    fileInfo.mimeVal     = retVal.mime = vRes.mime    
    retVal.width         = vRes.width
    retVal.height        = vRes.width
    retVal.dominantColor = vRes.dominantColor
    retVal.palette       = vRes.palette
    retVal.url           = await CloudStorageBase.uploadDataToCloudStorage(rc, vRes.data as Buffer, fileInfo)

    return retVal
}

  static async getMime(rc : RunContextServer, image : string | Buffer) : Promise<string> {
    const jimpImage : any = await jimp.read(image)
    return jimpImage.getMIME()
  }

  static async getDominantColor(rc : RunContextServer, image : string | Buffer) {
    const jimpImage : any      = await jimp.read(image),
          res       : number[] = colorThief.getColor(jimpImage)

    return {
      r : res[0],
      g : res[1],
      b : res[2]
    }
  }

  static async getPalette(rc : RunContextServer, image : string | Buffer) {
    const jimpImage : any   = await jimp.read(image),
          res       : any[] = colorThief.getPalette(jimpImage, 3),
          retVal    : any[] = []

    for(const val of res) {
      retVal.push({
        r : val[0],
        g : val[1],
        b : val[2]
      })
    }

    return retVal
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
    let jimpImage     : any      = await jimp.read(imageData),
        dominantColor : number[] = colorThief.getColor(jimpImage),
        palette       : any[]    = colorThief.getPalette(jimpImage, 3),
        paletteObj    : any[]    = [],
        dominantColorObj         = {
          r : dominantColor[0],
          g : dominantColor[1],
          b : dominantColor[2]
        }

    for(const val of palette) 
      paletteObj.push({
        r : val[0],
        g : val[1],
        b : val[2]
      })

    if(jimpImage._originalMime === `image/gif`) {
      const rand = uuid()
      images(imageData).save(`/tmp/opImage_${rand}.jpg`)
      jimpImage = await jimp.read(`/tmp/opImage_${rand}.jpg`)
      await fs.unlinkSync(`/tmp/opImage_${rand}.jpg`)
    } 

    let height : number,
        width  : number

    if(options.crops && options.crops.length) {
      const b = options.crops,
            x = b[0].x,
            y = b[0].y
      
      width  = b[1].x - b[0].x
      height = b[3].y - b[0].y,

      await jimpImage.crop(x, y, width, height)
    }

    if(options.shrink)  jimpImage.resize(options.shrink.w, options.shrink.h)
    if(options.quality) jimpImage.quality(options.quality)

    return new Promise<ProcessedReturn>((resolve, reject) => {
      jimpImage.getBuffer(jimpImage.getMIME(), (err : any, res : any) => {
          if(err) return reject(err)

          return resolve({data          : options.returnBase64 ? res.toString('base64') : res, 
                          mime          : jimpImage.getMIME(),
                          height        : (options.shrink) ? options.shrink.h : height,
                          width         : (options.shrink) ? options.shrink.w : width,
                          palette       : paletteObj,
                          dominantColor : dominantColorObj
                        })
        })
      })
  }
}