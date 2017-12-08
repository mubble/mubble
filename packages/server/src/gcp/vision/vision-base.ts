/*------------------------------------------------------------------------------
   About      : Google vision access
   
   Created on : Thu Jun 01 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const gVision = require('@google-cloud/vision'),
      ce      = require('colour-extractor')

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

    const colorMeta = await this.getColorMeta(imageData)

    return {
      data          : options.returnBase64 ? (await this.getGmBuffer(gmImage)).toString('base64') : await this.getGmBuffer(gmImage), 
      mime          : await this.getGmMime(gmImage),
      height        : (options.shrink) ? options.shrink.h : height,
      width         : (options.shrink) ? options.shrink.w : width,
      palette       : colorMeta.palette,
      dominantColor : colorMeta.dominantColor
    }
  }

  private static async processAndUpload(rc : RunContextServer, imageData : Buffer, options : ProcessOptions, fileInfo : GcsUUIDFileInfo) {
    const gmImage   = await gm(imageData),
          retVal    = {} as ProcessGcsReturn,
          mime      = await this.getGmMime(gmImage),
          colorMeta = await this.getColorMeta(imageData)

    fileInfo.mimeVal     = mime
    retVal.mime          = mime
    retVal.palette       = colorMeta.palette,
    retVal.dominantColor = colorMeta.dominantColor

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

  // private static getPalette(image : Buffer) {
  //   const colorThief = new DominantColor(),
  //         palette    = colorThief.getPalette(image, 3),
  //         retval     = []

  //   for(const val of palette) 
  //     retval.push({r : val[0], g : val[1], b : val[2]})

  //   return retval
  // }

  private static getColorMeta(image : Buffer) : Promise<{palette : any, dominantColor : any}> {
    const retVal : any    = {palette : []}
    let   count  : number = 0

    return new Promise((resolve, reject) => {
      ce.topColours(image, true, (data : any) => {
        for(const val of data) {
          count = count + 1
          if(count > 10) break
          const tempObj = {
            r : val[1][0],
            g : val[1][1],
            b : val[1][2]
          }
          if(!retVal.dominantColor) retVal.dominantColor = tempObj
          retVal.palette.push(tempObj)
          resolve(retVal)
        }
      })
    })
  }

  private static async getTopColors(img : any, tmpFilename : string) {
    const MAX_W      = 14,
          MIFF_START = 'comment={',
          MIFF_END   = '\x0A}\x0A\x0C\x0A'

    return new Promise((resolve, reject) => {
      img.size((error : any, wh : any) => {

      const ratio = wh.width/MAX_W,
            w2    = wh.width/2,
            h2    = wh.height/2

      img.noProfile()                               
        .bitdepth(8)                               
        .crop(w2, h2, w2/2, w2/2)                  
        .scale(Math.ceil(wh.height/ratio), MAX_W)  
        .write('histogram:' + tmpFilename, (error : any) => {
          let histogram = '',
              miffRS    = fs.createReadStream(tmpFilename, {encoding: 'utf8'})

          miffRS.addListener('data', (chunk : any) => {
            const endDelimiterPos = chunk.indexOf(MIFF_END)

            if(endDelimiterPos !== -1) {
              histogram += chunk.slice(0, endDelimiterPos + MIFF_END.length)
              miffRS.destroy()
            } else {
              histogram += chunk
            }
          })

          miffRS.addListener('close', () => {
            fs.unlink(tmpFilename)

            const histogram_start = histogram.indexOf(MIFF_START) + MIFF_START.length,
                  colours         = this.reduceSimilar(this.clean(histogram.slice(histogram_start)
                                      .split('\n')
                                      .slice(1, -3)
                                      .map(this.parseHistogramLine)
                                    ))

            const sortedColors = colours.sort(this.sortByFrequency)
            console.log('sortedColors', sortedColors)
          })
        })
      })
    })
  }


  private static sortByFrequency(arg1 : any, arg2 : any) {
    const a = arg1[0],
          b = arg2[0]

    if(a > b) return -1
    if(a < b) return 1
    return 0
  }

  private static reduceSimilar(xs : any) {
    let minD = Infinity,
        maxD = 0,
        maxF = 0,
        n    = 0,
        N    = xs.length - 1

    let tds = (() => {
      const results = []

      for(const x of xs) {
        if(n === N) break
        n = n + 1
        const distance = this.distance(x[1], xs[n][1])
        if(distance < minD) minD = distance
        if(distance > maxD) maxD = distance
        results.push(distance)
      }
      return results
    })()

    const avgD     = Math.sqrt(minD * maxD),
          rs : any = []

    for(const d of tds) {
      if(d > avgD) {
        this.include(xs[n], rs)
        if(xs[n][0] > maxF)
          maxF = xs[n][0]
      }
      n = n + 1
    }
    return rs.map((arg : any) => {
      const f = arg[0],
            c = arg[1]

      return [f / maxF, c]
    })
  }

  private static clean(xs : any) {
    const rs = []

    for (const x of xs)
      if(x) rs.push(x)

    return rs
  }

  private static parseHistogramLine(xs : any) {
    xs = xs.trim().split(':')
    if(xs.length !== 2) return null
  
    return [
      +xs[0], xs[1].split('(')[1].split(')')[0].split(',').map((x : any) => {
        return +x.trim()
      })
    ]
  }

  private static distance(arg1 : any, arg2 : any) {
    return Math.sqrt(Math.pow(arg1[0] - arg2[0], 2) + Math.pow(arg1[1] - arg2[1], 2) + Math.pow(arg1[2] - arg2[2], 2))
  }

  private static include(x : any, xs : any) {
    if(xs.indexOf(x) === -1) xs.push(x)
    return xs
  }
}