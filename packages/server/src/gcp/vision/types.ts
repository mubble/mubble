/*------------------------------------------------------------------------------
   About      : Types
   
   Created on : Tue Sep 05 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

export type VisionParameters = {
  ratio     ?: number,
  quality   ?: number,
  shrink    ?: {h: number, w: number}
}

export type ProcessedReturn = {
  data          : string | Buffer,
  mime          : string,
  height        : number,
  width         : number,
  dominantColor : number[],
  palette       : number[]
}

export type ProcessOptions = {
  returnBase64  : boolean
  crops        ?: any,
  shrink       ?: {h : number, w : number}
  quality      ?: number 
}

export type ProcessGcsReturn = {
  url           : string,
  mime          : string,
  width         : number,
  height        : number,
  dominantColor : number[],
  palette       : number[]
}