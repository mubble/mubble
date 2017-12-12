/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Tue Sep 05 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

export const VISION_ERROR_CODES = {
  CROP_DETECTION_FAILED    : 'CROP_DETECTION_FAILED',
  JIMP_FAILED_TO_READ      : 'JIMP_FAILED_TO_READ',
  IMAGE_PROCESSING_FAILED  : 'IMAGE_PROCESSING_FAILED',
  PALETTE_DETECTION_FAILED : 'PALETTE_DETECTION_FAILED'
}

export class VisionError extends Error {
    constructor(name: string, msg: string) {
        super(msg)
        super['name'] = name
    }
}