/*------------------------------------------------------------------------------
   About      : Types
   
   Created on : Tue Sep 05 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

export type VisionParameters = {
  ratio        ?: number
  quality      ?: number
  shrink       ?: {h: number, w: number}
  progressive  ?: boolean
}

export type ProcessedReturn = {
  data          : string | Buffer
  mime          : string
  height        : number
  width         : number
  palette       : rgb[]
}

export type ProcessOptions = {
  returnBase64  : boolean
  crops        ?: any
  shrink       ?: {h : number, w : number}
  palette       : boolean
  quality      ?: number 
}

export type ProcessGcsReturn = {
  url           : string
  mime          : string
  width         : number
  height        : number
  palette       : rgb[]
}

export type ProcessAbsReturn = {
  url           : string
  mime          : string
  width         : number
  height        : number
  palette       : rgb[]
}

export type SmartCropProcessReturn = {
  mime          : string
  height        : number
  width         : number
  palette       : rgb[]
  gmImage       : any
}

export type ImageMeta = {
  width         : number
  height        : number
}

export type ImageInfo = {
  size          : ImageMeta
}

export type rgb = {
  r             : number
  g             : number
  b             : number
}