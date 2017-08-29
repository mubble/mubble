/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Tue Jul 25 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

export class DomHelper {

  static addClass(className: string): void {

  }

  static getTransform(xPixel, yPixel, zPixel) {
    return {transform: `translate3d(${xPixel}px, ${yPixel}px, ${zPixel}px)`}
  }

  static getPercentTransform(xPercent, yPercent) {
    return {transform: `translate3d(${xPercent}%, ${yPercent}%, 0)`}
  }
  
}