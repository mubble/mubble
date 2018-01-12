/*------------------------------------------------------------------------------
   About      : Google vision access
   
   Created on : Thu Jun 01 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const gVision   = require('@google-cloud/vision'),
      smartcrop = require('smartcrop-gm')

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
        SmartCropProcessReturn,
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
  static MODEL   : string = 'SC' // 'SC'

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

    const func = (this.MODEL === 'VB') ? this.processDataVB : this.processDataSC
    return func (rc, imageData, imageOptions, resBase64)
  }

  static async processUrl(rc           : RunContextServer,
                          imageUrl     : string,
                          imageOptions : VisionParameters,
                          resBase64    : boolean) : Promise<ProcessedReturn> {

    const func = (this.MODEL === 'VB') ? this.processUrlVB : this.processUrlSC
    return func (rc, imageUrl, imageOptions, resBase64)
  }                        

  static async processDataToGcs(rc           : RunContextServer,
                                imageData    : Buffer,
                                imageOptions : VisionParameters,
                                fileInfo     : GcsUUIDFileInfo) : Promise<ProcessGcsReturn> {

    const func = (this.MODEL === 'VB') ? this.processDataToGcsVB : this.processDataToGcsSC
    return func (rc, imageData, imageOptions, fileInfo)
  }                        

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                               GM & SMARTCROP FUNCTIONS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
  private static async processDataSC(rc           : RunContextServer,
                                     imageData    : Buffer,
                                     imageOptions : VisionParameters,
                                     resBase64    : boolean) : Promise<ProcessedReturn> {

    const processedReturnVal  = await VisionBase.smartcropProcess(rc, imageData, imageOptions),
          retVal              = {} as ProcessedReturn

    Object.assign(retVal, processedReturnVal)

    retVal.data = resBase64 ? (await this.getGmBuffer(processedReturnVal.gmImage)).toString('base64') : await this.getGmBuffer(processedReturnVal.gmImage)

    return retVal
  }

  private static async processUrlSC(rc           : RunContextServer,
                                    imageUrl     : string,
                                    imageOptions : VisionParameters,
                                    resBase64    : boolean) : Promise<ProcessedReturn> {
    
    const imageData           = new Buffer(await executeHttpsRequest(rc, imageUrl, {'User-Agent': 'Newschat/1.0'}), 'binary'),
          processedReturnVal  = await VisionBase.smartcropProcess(rc, imageData, imageOptions),
          retVal              = {} as ProcessedReturn

    Object.assign(retVal, processedReturnVal)

    retVal.data = resBase64 ? (await this.getGmBuffer(processedReturnVal.gmImage)).toString('base64') : await this.getGmBuffer(processedReturnVal.gmImage)

    return retVal
  }

  private static async processDataToGcsSC(rc           : RunContextServer,
                                          imageData    : Buffer,
                                          imageOptions : VisionParameters,
                                          fileInfo     : GcsUUIDFileInfo) : Promise<ProcessGcsReturn> {
                      
    const retVal = {} as ProcessGcsReturn
    
    rc.isDebug() && rc.debug(rc.getName(this), `Detecting Crops: Image Data: ${imageData.length} bytes`)

    const res = await VisionBase.smartcropProcess(rc, imageData, imageOptions, fileInfo)

    Object.assign(retVal, res)

    fileInfo.mimeVal = res.mime
    retVal.url = await CloudStorageBase.uploadDataToCloudStorage(rc, res.gmImage.stream(), fileInfo)

    return retVal
  }

  private static async smartcropProcess(rc : RunContextServer, imageData : Buffer, imageOptions : VisionParameters, fileInfo ?: GcsUUIDFileInfo) {
    const retVal      = {} as SmartCropProcessReturn,
          bufferImage = await new Promise((resolve, reject) => {
      gm(imageData)
      .borderColor('black')
      .border(1, 1)
      .fuzz(16, true)
      .trim()
      .toBuffer((err, buff) => {
        if(err) rc.isError() && rc.error(rc.getName(this), `Error is ${err}`)
        resolve(buff)
      })
    }) as Buffer

    const ratio   : number  = imageOptions.ratio? imageOptions.ratio : 0,
          gmImage           = await gm(bufferImage)

    if(ratio != 0) {
      let w    : number = 0, 
          h    : number = 0,
          maxW : number = 0,
          maxH : number = 0

      await new Promise((resolve, reject) => {
        gmImage.identify(async (err : any, data : any) => {
          if(err) rc.isError() && rc.error(rc.getName(this), `Error is ${err}`)
            
          w    = data.size.width
          h    = data.size.height
          maxW = (w / ratio > h) ? h * ratio : w
          maxH = (w / ratio < h) ? w / ratio : h

          resolve()
        })
      })

      const result = await smartcrop.crop(bufferImage, {width : 100, height : 100}),
            crop   = result.topCrop,
            x      = (maxW + crop.x > w) ? (crop.x - ((maxW + crop.x) - w)) : crop.x,
            y      = (maxH + crop.y > h) ? (crop.y - ((maxH + crop.y) - h)) : crop.y

      gmImage.crop(maxW, maxH, x, y)
      retVal.height = (imageOptions.shrink) ? imageOptions.shrink.h : maxH
      retVal.width  = (imageOptions.shrink) ? imageOptions.shrink.w : maxW
    }

    const palette = await this.getTopColors(lo.cloneDeep(gmImage)),
          mime    = await this.getGmMime(gmImage)

    retVal.mime    = mime
    retVal.palette = palette as any
    retVal.gmImage = gmImage
          
    return retVal
  }

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                               VISION BASE FUNCTIONS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
  private static async processDataVB(rc           : RunContextServer,
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

  private static async processUrlVB(rc           : RunContextServer,
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

  private static async processDataToGcsVB(rc           : RunContextServer,
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

  private static async getImageMeta(rc : RunContextServer, imageData : Buffer) : Promise<ImageMeta> {
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
        if(error) reject(VISION_ERROR_CODES.IMAGE_PROCESSING_FAILED)
        resolve(buffer)
      })
    })
  }

  private static getGmMime(gmImage : any) : Promise<string> {
    return new Promise((resolve, reject) => {
      gmImage.format((error : any, data : any) => {
        if(error) reject(VISION_ERROR_CODES.IMAGE_PROCESSING_FAILED)
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
        
        writeStream.on('data', (data: any) => {strData = strData + data.toString()})
        writeStream.on('end', () => {resolve (strData)})
        writeStream.on('error', (error: any) => {throw(new Error(`${VISION_ERROR_CODES.PALETTE_DETECTION_FAILED} : ${error}`))})
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