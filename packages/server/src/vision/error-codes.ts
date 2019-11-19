/*------------------------------------------------------------------------------
   About      : Vision Errors
   
   Created on : Tue Nov 19 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
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