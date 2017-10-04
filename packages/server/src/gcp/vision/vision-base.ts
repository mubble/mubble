/*------------------------------------------------------------------------------
   About      : Google vision access
   
   Created on : Thu Jun 01 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const gVision : any = require('@google-cloud/vision')
import jimp         = require('jimp')

import {
        ERROR_CODES,
        VisionError
       }                            from './error-codes'
import {
        CloudStorageBase,
        GcsUUIDFileInfo
       }                            from '../cloudstorage/cloudstorage-base'
import {
        VisionParameters,
        ProcessedReturn,
        ProcessOptions
       }                            from './types'
import {RunContextServer}           from '../../rc-server'
import {GcloudEnv}                  from '../gcloud-env'
import * as request                 from 'request' 
import * as fs                      from 'fs' 
import * as images                  from 'images'

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
  static async processDataToBase64(rc         : RunContextServer, 
                                   imageData  : Buffer,
                                   imageOptions : VisionParameters) : Promise<ProcessedReturn> {

    const crops          : any = (imageOptions.ratio)
                  ? await VisionBase.detectCrops(rc, imageOptions.ratio, '', imageData) 
                  : null,
          image          : any = await jimp.read(imageData),
          processOptions       = {
            quality      : imageOptions.quality,
            shrink       : imageOptions.shrink,
            crops        : crops,
            returnBase64 : true
          } as ProcessOptions

    return VisionBase.process(rc, image, processOptions)
  }

static async processUrlToBase64(rc         : RunContextServer, 
                                imagePath  : string, //Image path can be a local path or a URL
                                ratio     ?: number,
                                quality   ?: number,
                                shrink    ?: {h: number, w: number}) : Promise<ProcessedReturn> {
    
    const crops          : any  = ratio ? await VisionBase.detectCrops(rc, ratio, imagePath) : null,
          image          : any  = await jimp.read(imagePath),
          processOptions        = {
            quality,
            shrink,
            crops,
            returnBase64 : true
          } as ProcessOptions 

    return VisionBase.process(rc, image, processOptions, imagePath)
  }

  static async processUrlToBinary(rc         : RunContextServer,
                                  imagePath  : string, //Image path can be a local path or a URL
                                  ratio     ?: number,
                                  quality   ?: number,
                                  shrink    ?: {h: number, w: number}) : Promise<ProcessedReturn>{
    
    let crops          : any = await VisionBase.detectCrops(rc, ratio || 1.78, imagePath),
        image          : any = await jimp.read(imagePath),
        processOptions       = {
          quality,
          shrink,
          crops,
          returnBase64 : false
        }  as ProcessOptions 

    return VisionBase.process(rc, image, processOptions, imagePath)
  }

  static async processDataToGcs(rc           : RunContextServer, 
                                imageData    : Buffer,
                                imageOptions : VisionParameters,
                                fileInfo     : GcsUUIDFileInfo) : Promise<string> {

    const crops          : any = (imageOptions.ratio && imageOptions.ratio !== 1)
                                  ? await VisionBase.detectCrops(rc, imageOptions.ratio, '', imageData) 
                                  : null,
          image          : any = await jimp.read(imageData),
          processOptions       = {
            quality      : imageOptions.quality,
            shrink       : imageOptions.shrink,
            crops        : crops,
            returnBase64 : false
          } as ProcessOptions

      
    const vRes = await VisionBase.process(rc, image, processOptions) as ProcessedReturn
    fileInfo.mimeVal = vRes.mime
    // TODO: Need to check if vRes.data works?
    return CloudStorageBase.uploadDataToCloudStorage(rc, vRes.data as Buffer, fileInfo)
}

  static async getMime(rc : RunContextServer, image : string | Buffer) : Promise<string> {
    const jimpImage : any = await jimp.read(image)
    return jimpImage.getMIME()
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
      throw(new VisionError(ERROR_CODES.CROP_DETECTION_FAILED, `Crop detection failed : ${JSON.stringify(error)}`))
    } 
  }

  private static async process(rc : RunContextServer, jimpImage : any, options : ProcessOptions, imagePath ?: string) {
    if(!jimpImage) throw(new VisionError(ERROR_CODES.JIMP_FAILED_TO_READ, `Jimp failed to read`))
    if(imagePath && jimpImage._originalMime === `image/gif`) {
      await new Promise((res, rej) => {
        request({
                  url      : imagePath,
                  method   : 'GET',
                  encoding : null
                }, (err, response, val) => {
          images(val).save('/tmp/opImage.jpg')
          res('')
        })
      })
      jimpImage = await jimp.read(`/tmp/opImage.jpg`)
      await fs.unlinkSync(`/tmp/opImage.jpg`)
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

          return resolve({data   : options.returnBase64 ? res.toString('base64') : res, 
                          mime   : jimpImage.getMIME(),
                          height : (options.shrink) ? options.shrink.h : height,
                          width  : (options.shrink) ? options.shrink.w : width
                        })
        })
      })
  }
}