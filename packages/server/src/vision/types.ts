/*------------------------------------------------------------------------------
   About      : Vision Types
   
   Created on : Tue Nov 19 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import * as stream from 'stream'

export type VisionParameters = {
  ratio       ?: number   // height / width
  quality     ?: number
  shrink      ?: {h: number, w: number}
  progressive ?: boolean
}

export type ProcessedReturn = {
  data    : string | Buffer
  mime    : string
  height  : number
  width   : number
  palette : rgb[]
}

export type SmartCropProcessReturn = {
  mime    : string
  height  : number
  width   : number
  palette : rgb[]
  stream  : stream.Readable
}

export type rgb = {
  r : number
  g : number
  b : number
}