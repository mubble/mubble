/*------------------------------------------------------------------------------
   About      : Vision Base
   
   Created on : Tue Nov 19 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import {
         VisionParameters,
         ProcessedReturn,
         SmartCropProcessReturn
       }                              from './types'
import { VISION_ERROR_CODES }         from './error-codes'
import { RunContextServer }           from '../rc-server'
import { SmartCropGM }                from './smartcrop-gm'
import { UStream }                    from '../util'
import * as gMagic                    from 'gm'
import * as mime                      from 'mime-types'
import * as lo                        from 'lodash'
import * as imagemin                  from 'imagemin'
import * as imageminMozjpeg           from 'imagemin-mozjpeg'

export class VisionBase {

  private static iMagic         : typeof gMagic | gMagic.SubClass
  private static useImageMagick : boolean

  static init(rc : RunContextServer, useIm ?: boolean) {
    
    rc.isDebug() && rc.debug(rc.getName(this), 'Initializing VisionBase.')

    this.useImageMagick = !!useIm

    if(useIm) {
      VisionBase.iMagic = gMagic.subClass({imageMagick : true})
    } else {
      VisionBase.iMagic = gMagic
    }
  }

  static async processData(rc           : RunContextServer,
                           imageData    : Buffer,
                           imageOptions : VisionParameters,
                           resBase64    : boolean) : Promise<ProcessedReturn> {

    const processedReturnVal = await VisionBase.processImage(rc, imageData, imageOptions),
          retVal             = {} as ProcessedReturn

    Object.assign(retVal, processedReturnVal)
    const uStream = new UStream.ReadStreams(rc, [processedReturnVal.stream]),
          buffer  = await uStream.read(UStream.Encoding.bin) as Buffer

    retVal.data = resBase64 ? buffer.toString('base64') : buffer
    return retVal
  }

/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                            INTERNAL  FUNCTIONS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

  private static async processImage(rc           : RunContextServer,
                                    imageData    : Buffer,
                                    imageOptions : VisionParameters) : Promise<SmartCropProcessReturn> {

    const retVal  = {} as SmartCropProcessReturn

    try {
      const gmImage      = VisionBase.iMagic(imageData).setFormat('jpeg'),
            croppedImage = imageOptions.ratio
                           ? await VisionBase.processRatio(rc, gmImage, imageOptions.ratio)
                           : gmImage,
            shrunkImage  = imageOptions.shrink
                           ? await VisionBase.shrinkImage(rc, croppedImage, imageOptions.shrink)
                           : croppedImage,
            finalImage   = imageOptions.progressive
                           ? await VisionBase.getProgressiveImage(rc, shrunkImage, imageOptions)
                           : shrunkImage,
            dimensions   = await VisionBase.getDimensions(rc, lo.cloneDeep(finalImage))

      retVal.width   = dimensions.width
      retVal.height  = dimensions.height
      retVal.mime    = await VisionBase.getGmMime(rc, lo.cloneDeep(finalImage))
      retVal.palette = await VisionBase.getTopColors(rc, lo.cloneDeep(finalImage)) as any

      finalImage.setFormat('jpeg')
      retVal.stream  = finalImage.stream()

      return retVal
    } catch(error) {
      rc.isError() && rc.error(rc.getName(this), 'Error in processing image.', error)
      throw(error)
    }
  }

  private static async getProgressiveImage(rc           : RunContextServer,
                                           gmImage      : gMagic.State,
                                           imageOptions : VisionParameters) {

    const gmImageBuffer     = await VisionBase.getGmBuffer(rc, gmImage),
          quality           = imageOptions.quality || 100,
          progressiveBuffer = await imagemin.buffer(gmImageBuffer, 
                                {plugins : [imageminMozjpeg({quality, progressive : true})]})

    return VisionBase.iMagic(progressiveBuffer)
  }

  private static async processRatio(rc : RunContextServer, gmImage : gMagic.State, ratio : number) {

    const bufferImage = await VisionBase.getGmBuffer(rc, lo.cloneDeep(gmImage)),
          dimensions  = await VisionBase.getDimensions(rc, lo.cloneDeep(gmImage)),
          w           = dimensions.width,
          h           = dimensions.height,
          maxW        = (w / ratio > h) ? h * ratio : w,
          maxH        = (w / ratio < h) ? w / ratio : h,
          scgm        = new SmartCropGM(rc, dimensions.width, dimensions.height, VisionBase.useImageMagick),
          crop        = (await scgm.crop(bufferImage, {width : 100, height : 100})).topCrop,
          x           = (maxW + crop.x > w) ? (crop.x - ((maxW + crop.x) - w)) : crop.x,
          y           = (maxH + crop.y > h) ? (crop.y - ((maxH + crop.y) - h)) : crop.y

    return gmImage.crop(maxW, maxH, x, y)
  }

  private static async shrinkImage(rc : RunContextServer, gmImage : gMagic.State, shrink : { w : number, h : number }) {

    const dimensions = await VisionBase.getDimensions(rc, lo.cloneDeep(gmImage))

    if(shrink && shrink.w && shrink.h && shrink.w <= dimensions.width && shrink.h <= dimensions.height) {
      return gmImage.resize(shrink.w, shrink.h, '!')
    }

    return gmImage
  }

  private static async getDimensions(rc      : RunContextServer,
                                     gmImage : gMagic.State) : Promise<{width : number, height : number}> {

    return await new Promise<{width : number, height : number}>((resolve, reject) => {

      gmImage.identify((err : any, value : gMagic.ImageInfo) => {
        if(err) {
          rc.isError() && rc.error(rc.getName(this), 'Error in identifying image buffer.', err)
          reject(err)
        }
        resolve({width : value.size.width, height : value.size.height})
      })
    })
  }

  private static async getGmBuffer(rc : RunContextServer, gmImage : gMagic.State) : Promise<Buffer> {

    return new Promise<Buffer>((resolve, reject) => {

      gmImage.toBuffer((error, buffer) => {
        if(error) {
          rc.isError() && rc.error(rc.getName(this), 'Error in converting gm image to buffer.', error)
          reject(VISION_ERROR_CODES.IMAGE_PROCESSING_FAILED)
        }
        resolve(buffer)
      })
    })
  }

  private static async getGmMime(rc : RunContextServer, gmImage : gMagic.State) : Promise<string> {

    return new Promise<string>((resolve, reject) => {

      gmImage.format((error, data) => {
        if(error) {
          rc.isError() && rc.error(rc.getName(this), 'Error in formating gm image to mime.', error)
          reject(VISION_ERROR_CODES.IMAGE_PROCESSING_FAILED)
        }
        resolve(mime.lookup(data) || '')
      })
    })
  }

  public static async getTopColors(rc : RunContextServer, gmImage : gMagic.State, count : number = 8) {
    const HIST_START = 'comment={',
          HIST_END   = '\x0A}'

    const strData = await new Promise<string>((resolve, reject) => {
      gmImage
      .noProfile()
      .colors(count)
      .toBuffer('histogram', (error, buffer) => {
        error && rc.isWarn() && rc.warn(rc.getName(this), `${VISION_ERROR_CODES.PALETTE_DETECTION_FAILED} : ${error}`)
        if(!buffer) return resolve('')
        resolve(buffer.toString())
      })
    })
    
    const beginIndex = strData.indexOf(HIST_START) + HIST_START.length + 1,
          endIndex   = strData.indexOf(HIST_END),
          cData      = strData.slice(beginIndex, endIndex).split('\n')
  
    if(cData.length > count) cData.splice(0, cData.length - count)
    if(beginIndex === -1 || endIndex === -1) return []

    return lo.map(cData, VisionBase.parseHistogramLine)
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