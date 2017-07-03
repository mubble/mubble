/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Sun Jun 25 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const APP_VERSION = 'global.appVersion'
const JS_VERSION  = 'global.jsVersion'

export class GlobalKeyValue {

  private _appVersion    : string
  private _jsVersion     : string

  constructor() {
    this._appVersion = localStorage.getItem(APP_VERSION)
    this._jsVersion  = localStorage.getItem(JS_VERSION)
  }

  setVersions(appVersion: string, jsVersion: string) {

    this._appVersion = appVersion
    this._jsVersion  = jsVersion

    localStorage.setItem(APP_VERSION, this._appVersion)
    localStorage.setItem(JS_VERSION, this._jsVersion)
  }

  

}