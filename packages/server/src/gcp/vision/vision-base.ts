/*------------------------------------------------------------------------------
   About      : Google vision access
   
   Created on : Thu Jun 01 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const gVision = require('@google-cloud/vision')

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
        ProcessGcsReturn,
        ImageMeta
       }                            from './types'
import {RunContextServer}           from '../../rc-server'
import {executeHttpsRequest}        from '../../util/https-request'
import {GcloudEnv}                  from '../gcloud-env'
import * as request                 from 'request' 
import * as fs                      from 'fs'
import * as uuid                    from 'uuid/v4'
import * as gm                      from 'gm'
import * as mime                    from 'mime-types'
import * as stream                  from 'stream'
import * as lo                      from 'lodash'

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

static async getImageMeta(rc : RunContextServer, imageData : Buffer) : Promise<ImageMeta> {
  const gmImage = gm(imageData)

  return new Promise((resolve, reject) => {
    gmImage.size((error, size) => {
      if(error) reject(error)

      const retVal : ImageMeta = {
        height : size.height,
        width  : size.width
      }
      
      resolve(retVal) 
    })
  }) as Promise<ImageMeta>
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

    const palette = await this.getTopColors(lo.cloneDeep(gmImage))

    return {
      data    : options.returnBase64 ? (await this.getGmBuffer(gmImage)).toString('base64') : await this.getGmBuffer(gmImage), 
      mime    : await this.getGmMime(gmImage),
      height  : (options.shrink) ? options.shrink.h : height,
      width   : (options.shrink) ? options.shrink.w : width,
      palette : palette as any
    }
  }

  private static async processAndUpload(rc : RunContextServer, imageData : Buffer, options : ProcessOptions, fileInfo : GcsUUIDFileInfo) {
    const gmImage   = await gm(imageData),
          retVal    = {} as ProcessGcsReturn,
          mime      = await this.getGmMime(gmImage),
          palette   = await this.getTopColors(lo.cloneDeep(gmImage))

    fileInfo.mimeVal = mime
    retVal.mime      = mime
    retVal.palette   = palette as any

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

  private static async getTopColors(img : any) {
    const HIST_START = 'comment={',
          HIST_END   = '\x0A}\x0A\x0C\x0A'

    const strData = await new Promise((resolve, reject) => {
      img.noProfile()
      .colors(8)
      .stream('histogram', (error : any, stdout : any, stderr : any) => {
        if(error || !stdout) throw(new Error(`${VISION_ERROR_CODES.PALETTE_DETECTION_FAILED} : ${error || stderr}`))
        const writeStream = new stream.PassThrough()
        let   strData     = ''
        
        writeStream.on('data', (data) => {strData = strData + data.toString()})
        writeStream.on('end', () => {resolve (strData)})
        writeStream.on('error', (error) => {throw(new Error(`${VISION_ERROR_CODES.PALETTE_DETECTION_FAILED} : ${error}`))})
        stdout.pipe(writeStream)
      }) 
    }) as string
    
    
    const beginIndex = strData.indexOf(HIST_START) + HIST_START.length + 1,
          endIndex   = strData.indexOf(HIST_END),
          cData      = strData.slice(beginIndex, endIndex).split('\n')
  
    if(beginIndex === -1 || endIndex === -1) throw(new Error(`${VISION_ERROR_CODES.PALETTE_DETECTION_FAILED} : HIST_START or HIST_END not found`))

    return lo.map(cData, this.parseHistogramLine)
  }

  private static parseHistogramLine(xs : any) {
    xs = xs.trim().split(':')
    if(xs.length !== 2) return null
  
    const res = xs[1].split('(')[1].split(')')[0].split(',')

    return {
      r : Number(res[0]),
      g : Number(res[1]),
      b : Number(res[2])
    }
  }
}