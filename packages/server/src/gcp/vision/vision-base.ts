/*------------------------------------------------------------------------------
   About      : Google vision access
   
   Created on : Thu Jun 01 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const imagemin        = require('imagemin'),
      imageminMozjpeg = require('imagemin-mozjpeg')

import {
        VisionParameters,
        ProcessedReturn,
        SmartCropProcessReturn,
        ImageMeta,
        ImageInfo
       }                            from './types'
import {VISION_ERROR_CODES}         from './error-codes'
import {RunContextServer}           from '../../rc-server'
import {executeHttpsRequest}        from '../../util/https-request'
import {GcloudEnv}                  from '../gcloud-env'
import {SmartCropGM}                from './smartcrop-gm'
import {UStream}                    from '../..'
import * as gm                      from 'gm'
import * as mime                    from 'mime-types'
import * as lo                      from 'lodash'
import * as sharp                   from 'sharp'
import * as fs                      from 'fs'
export class VisionBase {

  static _vision : any

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                      INITIALIZATION FUNCTION
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
  static init(rc : RunContextServer, gcloudEnv : GcloudEnv) {
  }

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                                FUNCTIONS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
                   
  static async processBufferData(rc           : RunContextServer,
                                 imageData    : Buffer,
                                 imageOptions : VisionParameters) : Promise<SmartCropProcessReturn> {

    rc.isDebug() && rc.debug(rc.getName(this), `Image Data: ${imageData.length} bytes`)

    return VisionBase.processImage(rc, imageData, imageOptions)
  }

  static async getImageInfo(rc        : RunContextServer,
                            imageData : Buffer) : Promise<ImageInfo> {

    const imageMeta = await VisionBase.getImageMeta(rc, imageData)

    return {size : imageMeta}
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

  static async processUrl(rc           : RunContextServer,
                          imageUrl     : string,
                          imageOptions : VisionParameters,
                          resBase64    : boolean) : Promise<ProcessedReturn> {
    
    const retVal             = {} as ProcessedReturn,
          imageData          = new Buffer(await executeHttpsRequest(rc, imageUrl, {'User-Agent': 'Newschat/1.0'}), 'binary'),
          processedReturnVal = await VisionBase.processImage(rc, imageData, imageOptions)

    Object.assign(retVal, processedReturnVal)

    const uStream = new UStream.ReadStreams(rc, [processedReturnVal.stream]),
          buffer  = await uStream.read(UStream.Encoding.bin) as Buffer
          
    retVal.data = resBase64 ? buffer.toString('base64') : buffer
    return retVal
  }

  static async getImageDimensions(rc : RunContextServer, imageData : Buffer) : Promise<{width : number, height : number}>{
    return new Promise<{width : number, height : number}>((resolve, reject) => {
      gm(imageData).identify((err : any, data : any) => {
        if(err) {
          rc.isError() && rc.error(rc.getName(this), `Error in identifying image buffer : ${err.message}`)
          reject(err)
        }
        resolve({width : data.size.width, height : data.size.height})
      })
    })
  }

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                            INTERNAL  FUNCTIONS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

  private static async processImage(rc : RunContextServer, imageData : Buffer, imageOptions : VisionParameters) : Promise<SmartCropProcessReturn> {
    const traceId = rc.getName(this) + '_smartcropProcess',
          ack     = rc.startTraceSpan(traceId),
          retVal  = {} as SmartCropProcessReturn
    try {
      let gmImage = gm(imageData)
      .borderColor('black')
      .border(1, 1)
      .fuzz(16, true)
      .trim()
      .setFormat('jpeg')

      if(imageOptions.ratio) gmImage = await VisionBase.processRatio(rc, gmImage, imageOptions.ratio)

      if(imageOptions.shrink) gmImage.resize(imageOptions.shrink.w, imageOptions.shrink.h, '!')


      //Always returns progressive Image
      const finalImage = await VisionBase.getProgressiveImage(rc, gmImage, imageOptions),
            dimensions = await VisionBase.getDimensions(rc, lo.cloneDeep(finalImage))

      retVal.width   = dimensions.width
      retVal.height  = dimensions.height
      retVal.mime    = await VisionBase.getGmMime(lo.cloneDeep(finalImage))
      retVal.palette = await VisionBase.getTopColors(rc, lo.cloneDeep(finalImage)) as any
      retVal.stream  = finalImage.stream()

      return retVal
    } catch(error) {
      rc.isError() && rc.error(rc.getName(this), `Error is ${error.message}`)
      throw(error)
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
  }

  private static async getProgressiveImage(rc : RunContextServer, gmImage : gm.State, imageOptions : VisionParameters) {
    const gmImageBuffer     = await VisionBase.getGmBuffer(gmImage),
          quality           = imageOptions.quality || 100,
          progressiveBuffer = await imagemin.buffer(gmImageBuffer, 
                                {use : [imageminMozjpeg({quality, progressive : true})]})

    return gm(progressiveBuffer)
  }

  private static async processRatio(rc : RunContextServer, gmImage : gm.State, ratio : number) {
    const bufferImage = await VisionBase.getGmBuffer(lo.cloneDeep(gmImage)),
          dimensions  = await VisionBase.getDimensions(rc, lo.cloneDeep(gmImage)),
          w           = dimensions.width,
          h           = dimensions.height,
          maxW        = (w / ratio > h) ? h * ratio : w,
          maxH        = (w / ratio < h) ? w / ratio : h,
          crop        = (await SmartCropGM.crop(bufferImage, {width : 100, height : 100})).topCrop,
          x           = (maxW + crop.x > w) ? (crop.x - ((maxW + crop.x) - w)) : crop.x,
          y           = (maxH + crop.y > h) ? (crop.y - ((maxH + crop.y) - h)) : crop.y

    if(!(w / h <= 1.05 && w / h >= 0.7 && ratio >= 1.3)) return gmImage.crop(maxW, maxH, x, y)

    const logoColors = await VisionBase.checkLogoBorders(rc, lo.cloneDeep(gmImage), w, h),
          desiredW   = Math.round(h * ratio),
          bgImage    = lo.cloneDeep(gmImage)

    if(logoColors) {                                // Image is a logo
      bgImage
      .resize(desiredW, h, '!')
      .stroke(logoColors[0], 0)
      .fill(logoColors[0])
      .drawRectangle(0, 0, desiredW / 2, h)
      .stroke(logoColors[1], 0)
      .fill(logoColors[1])
      .drawRectangle(desiredW / 2, 0, desiredW, h)
    } else {                                        // Image is not a logo
      bgImage
      .crop(maxW, maxH, x, y)
      .resize(desiredW, h, '!')
      .blur(0, h <= 200 ? 10 : 15)
    }

    const bgBuffer = await VisionBase.getGmBuffer(bgImage)

    const finalBuffer = await new Promise<Buffer>((resolve, reject) => {
      sharp(bgBuffer)
      .overlayWith(bufferImage)
      .toBuffer((err, buff) => {
        if(err) {
          rc.isError() && rc.error(rc.getName(this), `Error in converting overlay image to buffer : ${err.message}`)
          reject(err)
        }
        resolve(buff)
      })
    })

    return gm(finalBuffer)
  }

  private static async checkLogoBorders(rc : RunContextServer, gmImage : gm.State, w : number, h : number) {
    const leftBorderSD  = await VisionBase.getSD(rc, lo.cloneDeep(gmImage), 3, h, 0, 0),
          rightBorderSD = await VisionBase.getSD(rc, lo.cloneDeep(gmImage), 3, h, w - 3, 0)

    if(!leftBorderSD || !rightBorderSD) false
    
    const leftBorderTrue  = lo.cloneDeep(gmImage).crop(3, h, 0, 0),
          rightBorderTrue = gmImage.crop(3, h, w - 3, 0),
          lbColours       = await VisionBase.getTopColors(rc, leftBorderTrue, 1),
          rbColours       = await VisionBase.getTopColors(rc, rightBorderTrue, 1),
          lbColor         = lbColours[0],
          rbColor         = rbColours[0]

    if(!lbColor || !rbColor) return false

    const hexColorLeft  = `#${(lbColor.r).toString(16)}${(lbColor.g).toString(16)}${(lbColor.b).toString(16)}`,
          hexColorRight = `#${(rbColor.r).toString(16)}${(rbColor.g).toString(16)}${(rbColor.b).toString(16)}`

    return [hexColorLeft, hexColorRight]
  }

  private static async getSD(rc : RunContextServer, gmImage : gm.State, w : number, h : number, x : number, y : number) {
    return new Promise((resolve, reject) => {
      gmImage
      .colorspace('Gray')
      .crop(w, h, x, y)
      .identify((err : any, data : any) => {
        if(err) {
          rc.isError() && rc.error(rc.getName(this), `Error in identifying image buffer : ${err.message}`)
          reject(err)
        }

        const colorSD : {[id : string] : any} = {}
        Object.keys(data['Channel Statistics']).forEach((key) => {
          colorSD[key] = Number(((((data['Channel Statistics'])[key])['Standard Deviation']).split(' ('))[0])
        })

        const isSDLessThan1300 = Object.keys(colorSD).every((key) => {
          if(colorSD[key] < 1300) return true
          else return false
        })

        isSDLessThan1300 ? resolve(true) : resolve(false)
      })
    })
  }

  private static async getImageMeta(rc : RunContextServer, imageData : Buffer) : Promise<ImageMeta> {
    return new Promise<ImageMeta>((resolve, reject) => {
      gm(imageData).size((error, size) => {
        if(error) reject(error)

        resolve({height : size.height, width : size.width})
      })
    })
  }

  private static async getDimensions(rc : RunContextServer, gmImage : gm.State) : Promise<{width : number, height : number}>{
    return new Promise<{width : number, height : number}>((resolve, reject) => {
      gmImage.identify((err : any, data : any) => {
        if(err) {
          rc.isError() && rc.error(rc.getName(this), `Error in identifying image buffer : ${err.message}`)
          reject(err)
        }
        resolve({width : data.size.width, height : data.size.height})
      })
    })
  }

  private static async getGmBuffer(gmImage : gm.State) : Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      gmImage.toBuffer((error, buffer) => {
        if(error) reject(VISION_ERROR_CODES.IMAGE_PROCESSING_FAILED)
        resolve(buffer)
      })
    })
  }

  private static async getGmMime(gmImage : gm.State) : Promise<string> {
    return new Promise<string>((resolve, reject) => {
      gmImage.format((error, data) => {
        if(error) reject(VISION_ERROR_CODES.IMAGE_PROCESSING_FAILED)
        resolve(mime.lookup(data) || '')
      })
    })
  }

  public static async getTopColors(rc : RunContextServer, gmImage : gm.State, count : number = 8) {
    const HIST_START = 'comment={',
          HIST_END   = '\x0A}'

    const strData = await new Promise<string>((resolve, reject) => {
      gmImage
      .noProfile()
      .colors(count)
      .toBuffer('histogram', (error, buffer) => {
        rc.isWarn() && rc.warn(rc.getName(this), `${VISION_ERROR_CODES.PALETTE_DETECTION_FAILED} : ${error}`)
        if(!buffer) return resolve('')
        resolve(buffer.toString())
      })
    })
    
    const beginIndex = strData.indexOf(HIST_START) + HIST_START.length + 1,
          endIndex   = strData.indexOf(HIST_END),
          cData      = strData.slice(beginIndex, endIndex).split('\n')
  
    if(cData.length > count) cData.splice(0, cData.length - count)
    if(beginIndex === -1 || endIndex === -1) return []
    // throw(new Error(`${VISION_ERROR_CODES.PALETTE_DETECTION_FAILED} : HIST_START or HIST_END not found`))

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