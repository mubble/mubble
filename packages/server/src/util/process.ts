/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Thu Apr 06 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as semver from "semver"

export function valNodeVersion():boolean {
  
  const ver = process.version
  return semver.gte(ver, '6.10.0')
}

