/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Tue Jul 25 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {
  Mubble
} from '@mubble/core'

const QUICK_ANIM_MS     = (1000/60) + 'ms'

export class DomHelper {

  static addClass(className: string): void {

  }

  static getTransform(xPixel: number, yPixel: number, zPixel: number): Mubble.uObject<string> {
    return {transform: `translate3d(${xPixel}px, ${yPixel}px, ${zPixel}px)`}
  }

  static getPercentTransform(xPercent: number, yPercent: number): Mubble.uObject<string> {
    return {transform: `translate3d(${xPercent}%, ${yPercent}%, 0)`}
  }
  
  static setTransform(elem, xPixel, yPixel, zPixel): void {
    elem.style.transform = DomHelper.getTransform(xPixel, yPixel, zPixel).transform
  }

  static setPercentTransform(elem, xPercent: number, yPercent: number): void {
    elem.style.transform = DomHelper.getPercentTransform(xPercent, yPercent).transform
  }
  
  static getQuickAnim(): string {
    return QUICK_ANIM_MS
  }
}