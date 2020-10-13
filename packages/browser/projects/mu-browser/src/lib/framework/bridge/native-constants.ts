/*------------------------------------------------------------------------------
   About      : Constants with native platform
   
   Created on : Fri Nov 02 2018
   Author     : Sid
   
   Copyright (c) 2018 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

export const TOAST_DURATION       = 5000
export const TOAST_DURATION_DEBUG = 10000

export const LAUNCH_CONTEXT = {
  TYPE : 'type',
  MODE : 'mode',
  DATA : 'data'
}

export const LaunchContextMode = {
  BUSINESS : 'business'
}

export const ANDROID_PERM = {
  STORAGE   : 'android.permission.WRITE_EXTERNAL_STORAGE',
  CAMERA    : 'android.permission.CAMERA',
  LOCATION  : 'android.permission.ACCESS_FINE_LOCATION',
  CONTACTS  : 'android.permission.READ_CONTACTS',
  SMS       : 'android.permission.READ_SMS',
  GALLERY   : 'android.permission.WRITE_EXTERNAL_STORAGE',
}

export const IOS_PERM = {
  STORAGE   : 'STORAGE',
  CAMERA    : 'CAMERA',
  LOCATION  : 'LOCATION',
  CONTACTS  : 'CONTACTS',
  SMS       : 'SMS',
  GALLERY   : 'PHOTOS'
}

export const BROWSER_PERM = {
  STORAGE   : 'STORAGE',
  CAMERA    : 'CAMERA',
  LOCATION  : 'LOCATION',
  CONTACTS  : 'CONTACTS',
  SMS       : 'SMS',
  GALLERY   : 'STORAGE'
}

export const FINGERPRINT_ERROR = {
  KEY_DOES_NOT_EXIST      : 'KEY_DOES_NOT_EXIST',
  KEY_INVALIDATED         : 'KEY_INVALIDATED',
  TIMED_OUT               : 'TIMED_OUT',
  USER_CANCELLED          : 'USER_CANCELLED',
  NOT_SUPPORTED           : 'NOT_SUPPORTED',
  AUTH_FAILED             : 'AUTH_FAILED',
  FP_CREDENTIALS_MISMATCH : 'FP_CREDENTIALS_MISMATCH'
}

export enum Permission {
  STORAGE   = 'STORAGE',
  CAMERA    = 'CAMERA',
  LOCATION  = 'LOCATION',
  CONTACTS  = 'CONTACTS',
  SMS       = 'SMS',
  GALLERY   = 'GALLERY'
}

export namespace MobileSdkResponse {

  export namespace CollectRequest {

    export enum Response {
      ACKNOWLEDGED = 'ACKNOWLEDGED',
      COMPLETED    = 'COMPLETED',
      DECLINED     = 'DECLINED'
    }
  }
}

export interface NativeRouterResponse {
  errorCode     : string
  errorMessage  : string
  data          : object
  events        : Array<JSON>
}