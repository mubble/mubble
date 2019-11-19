/*------------------------------------------------------------------------------
   About      : Smartcrop used with gm
   
   Created on : Wed Jan 17 2018
   Author     : Vishal SInha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { RunContextServer }   from '../rc-server'
import * as gMagic            from 'gm'

const iMagic = gMagic.subClass({imageMagick : true})

const smartcrop = require('smartcrop')

export class SmartCropGM {

  constructor (rc: RunContextServer, private width: number, private height: number) {

  }

  async crop(img : any, options : any) {
    options = options || {}
    options.imageOperations = {
      open     : this.open.bind(this),
      resample : this.resample,
      getData  : this.getData
    }

    return smartcrop.crop(img, options)
  }

  private async open(src : any) {
    return {width : this.width, height: this.height, _gm : iMagic(src) }
  }

  private async resample(image : any, width : number, height : number) {
    return new Promise((resolve, reject) => {
      resolve({
        width  : Math.floor(width),
        height : Math.floor(height),
        _gm    : image._gm
      })
    })
  }

  private async getData(image : any) {
    return new Promise((resolve, reject) => {
      image._gm
      .resize(image.width, image.height, '!')
      .toBuffer('RGBA', (err : any, buffer : Buffer) => {
        if (err) reject(err)
        resolve(new smartcrop.ImgData(image.width, image.height, buffer))
      })
    })
  }
  
  // Old Static Functions...
  static async cropStatic(img : any, options : any) {
    options = options || {}
    options.imageOperations = {
      open     : this.openStatic,
      resample : this.resampleStatic,
      getData  : this.getDataStatic
    }

    return smartcrop.crop(img, options)
  }

  private static async openStatic(src : any) {
    return new Promise((resolve, reject) => {
      const _gm = iMagic(src)
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

  private static async resampleStatic(image : any, width : number, height : number) {
    return new Promise((resolve, reject) => {
      resolve({
        width  : Math.floor(width),
        height : Math.floor(height),
        _gm    : image._gm
      })
    })
  }

  private static async getDataStatic(image : any) {
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