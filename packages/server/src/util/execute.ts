/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Thu Apr 20 2017
   Author     : Akash Dathan
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as child_process from 'child_process'

export function execCmd (cmd : string, ignoreStdErr ?: boolean, ignoreErr ?: boolean) : Promise<string> {
    const exec = child_process.exec

    return new Promise(function(resolve, reject) {
      exec(cmd, {maxBuffer: 1024 * 500}, function (err, stdout, stderr) {
        if (err && !ignoreErr) return reject(err)
        if (!ignoreStdErr && stderr) return reject(stderr)
        
        return stdout ? resolve(stdout) : resolve('')
      })
    })
  }