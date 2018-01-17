/*------------------------------------------------------------------------------
   About      : Copy of smartcrop-gm source code
   
   Created on : Wed Jan 17 2018
   Author     : Vishal SInha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const smartcrop = require('smartcrop')
import * as gm from 'gm'

export class SmartCropGM {
  static async crop(img : any, options : any) {
    options = options || {}
    options.imageOperations = {
      open     : this.open,
      resample : this.resample,
      getData  : this.getData
    }

    return smartcrop.crop(img, options)
  }

  private static async open(src : any) {
    return new Promise((resolve, reject) => {
      const _gm = gm(src)
      _gm.size((err, size) => {
        if (err) reject(err)
        resolve({
          width  : size.width,
          height : size.height,
          _gm    : _gm
        })
      })
    })
  }

  private static async resample(image : any, width : number, height : number) {
    return new Promise((resolve, reject) => {
      resolve({
        width  : Math.floor(width),
        height : Math.floor(height),
        _gm    : image._gm
      })
    })
  }

  private static async getData(image : any) {
    return new Promise((resolve, reject) => {
      image._gm
      .resize(image.width, image.height, '!')
      .toBuffer('RGBA', (err : any, buffer : Buffer) => {
        if (err) reject(err)
        resolve(new smartcrop.ImgData(image.width, image.height, buffer))
      })
    })
  }
}