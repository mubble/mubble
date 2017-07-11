/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Thu Apr 20 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as os from 'os'

export function getSystemUserId () {
  const username = os.userInfo().username
  
  if(username.toLowerCase() === 'mubble') return os.hostname().split('.').join('-')
  return username
}

export function getHomeDir() {
  return os.userInfo().homedir
}