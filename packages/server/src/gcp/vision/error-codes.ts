/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Tue Sep 05 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

export const ERROR_CODES = {
  CROP_DETECTION_FAILED : 'CROP_DETECTION_FAILED'
}

export class VisionError extends Error {
    constructor(name: string, msg: string) {
        super(msg)
        super['name'] = name
    }
}