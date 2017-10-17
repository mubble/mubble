/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Tue Oct 17 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

export namespace Core {

  // This function protects an object / array from modifications
  export function protect(inp) {
    Object.freeze(inp)
  }



}