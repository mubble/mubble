import { Mubble, 
         expandTemplate,
         expandTemplateObj,
         XmnError,
         NetworkType
       }                        from '@mubble/core'
import { UrlHelper }            from './url-helper'
import { RunContextBrowser }    from '../rc-browser'
import { TranslateService } from '../ui'

export class MuUtility {


  isOfTypeUiError(errObj : Object) : errObj is {errorCode  : string, errorMessage ?: string} {
    return errObj.hasOwnProperty('errorCode')
  }

  isNetworkUnhealthy(rc: RunContextBrowser) {

    if (rc.bridge.isRunningInBrowser()) {
      return !navigator.onLine 
    } else {
      const netType = rc.bridge.getCordovaNetworkType()
      return netType === NetworkType.absent || 
            (netType === NetworkType.unknown && !navigator.onLine)
    }
  }

  isValidIndianMobNum(number: string): boolean {

    number = this.sanitizeNumber(number) 
    return new RegExp('^\\+91[9876]\\d{9}$').test(number)
  }

  
  get10digitMobNumber(number: string) {

    const num = this.sanitizeNumber(number)

    if (num.startsWith('+91')) return num.substring(3)
    if (num.startsWith('91')) return num.substring(2)
    else if (num.startsWith('0')) return num.substring(1)
    else return num
  }

  sanitizeNumber(number: string): string {

    let temp: string = number
    if (!temp) return null

    const startsWithPlus = temp.startsWith('+91')
    if (startsWithPlus) return temp

    // check for indian or international i.e. 0 or 00
    if (temp.startsWith('0')) {
      temp = temp.substring(1)

      if (temp.startsWith('0')) {
        return '+' + temp.substring(1)
      } else if (temp.length === 10) {
        return '+91' + temp
      } else {
        return '0' + temp
      }

      // 10 digit mobile/landline number case return with +91
    } else if (temp.length == 10) {
      return '+91' + temp
    }

    return temp
  }


  getNetworkType(rc: RunContextBrowser) {
    return rc.bridge.isRunningInBrowser() 
      ? navigator.onLine ? NetworkType.wifi : NetworkType.absent 
      : rc.bridge.getCordovaNetworkType() 
  }

  getErrorText(rc: RunContextBrowser, transServ: TranslateService, errorMessage: string): string {

    let errorText: string
    switch(errorMessage) {

      case XmnError.NetworkNotPresent:
        errorText = transServ.instant('cmn_toast_err_net_off')
        break

      case XmnError.ConnectionFailed:
        if (this.isNetworkUnhealthy(rc)) {
          errorText = transServ.instant('cmn_toast_err_net_off')
        } else {
          errorText = transServ.instant('cmn_toast_err_con_failed')
        }
        break

      case XmnError.RequestTimedOut:
      case XmnError.SendTimedOut:
        errorText = transServ.instant('cmn_toast_err_timeout')
        break
      
      default:
        errorText = transServ.instant('cmn_toast_err_unknown')
    }
    return errorText
  }  


  getLocation(rc: RunContextBrowser) {

    if (rc.bridge.isRunningInBrowser()) {

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
          return JSON.stringify({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        })
      } else {
        return '{}'
      }

    } else {
      return rc.bridge.getLocation()
    }
  }


  expandTemplate(template: string, data: Mubble.uObject<any>): string {
    return expandTemplate(template, data)
  }

  expandTemplateObj(templateObj: any, data: Mubble.uObject<any>): any {
    return expandTemplateObj(templateObj, data)
  }
  
  parseURLForRouter(parser: any) {

    if (parser.protocol !== 'http' || parser.protocol !== 'https') {
      parser.href = parser.href.replace(/.*\:\/\//, 'http://')
    }

    const searchObject = {},
          queries      = parser.search.replace(/^\?/, '').split('&')
    
    for(let i = 0; i < queries.length; i++ ) {
      if (!queries[i]) continue
      const split = queries[i].split('=');
      searchObject[split[0]] = decodeURIComponent(split[1])  
    }

    const pathname = parser.pathname.startsWith('/') 
      ? parser.pathname.substring(1) 
      : parser.pathname

    return {
        protocol      : parser.protocol,
        host          : parser.host,
        hostname      : parser.hostname,
        port          : parser.port,
        pathname      : pathname,
        search        : parser.search,
        searchObject  : searchObject,
        hash          : parser.hash
    }
  }

  getUrlParams(genericUrl: string) {
    return UrlHelper.getUrlParams(genericUrl)
  }
  
  getErrorScreenState(errorMessage: string): string {
    
    let errorCode: string
    switch(errorMessage) {

      case XmnError.NetworkNotPresent:
        errorCode = 'NoNet'
        break

      case XmnError.ConnectionFailed:
        errorCode = 'ConnFail'
        break

      case XmnError.RequestTimedOut:
      case XmnError.SendTimedOut:
        errorCode = 'TimedOut'
        break

      case XmnError.UnAuthorized:
        errorCode = 'UnAuthorized'

      default:
        errorCode = errorMessage.substring(0, Math.min(32, errorMessage.length))
    }
    return errorCode
  }

  async getBase64(file : any) {
    
    return new Promise((resolve, reject) => {

      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = error => reject(error)
    })

  }

  async getCheckSum(message : string)  {

    const encoder   = new TextEncoder(),
          data      = encoder.encode(message),
          buffer    = await window.crypto.subtle.digest('SHA-256', data),
          hexString = this.hexString(buffer)
    
    return hexString
  }

  hexString(buffer : ArrayBuffer) {

    const byteArray = new Uint8Array(buffer)

    let hexCode = '',
        value

    for (let i = 0; i < byteArray.length; i++) {
      value    = byteArray[i].toString(16),
      hexCode += (value.length === 1 ? '0' + value : value)
    }
    return hexCode
  }

  async getCompressedImage(file : any, changeOrientation : boolean  = false) {

    return new Promise((resolve, reject) => {
      
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (readerEvent : any) => {

        const image = new Image()
        image.src = readerEvent.target.result
      
        image.onload = (imageEvent : any) => {
          
          const exif  = window['EXIF']

          if (exif) {
            exif.getData(file, () =>  {
              const orientation = changeOrientation ? file.exifdata.Orientation : undefined
              return resolve(this.getCanvasImage(image, orientation))
            })
          } else {
            return resolve(this.getCanvasImage(image))
          }
        }
      }
      reader.onerror = error => reject(error)
    })
  }

  getCanvasImage(image : any, orientation ?: number) {

    const canvas  = document.createElement('canvas'),
          ctx     = canvas.getContext('2d'),
          maxSize = 800
                  
    let width = image.width,
        height = image.height;

    if (width > height) {
      if (width > maxSize) {
        height *= maxSize / width
        width   = maxSize
      }
    } else if (height > maxSize) {
      width *= maxSize / height
      height = maxSize
    }
              
    canvas.width  = width
    canvas.height = height

    if (orientation) {
      if (orientation > 4) {
        canvas.width  = height; 
        canvas.height = width;
      }
      switch (orientation) {
        case 2: ctx.translate(width, 0);     ctx.scale(-1,1); break;
        case 3: ctx.translate(width,height); ctx.rotate(Math.PI); break;
        case 4: ctx.translate(0,height);     ctx.scale(1,-1); break;
        case 5: ctx.rotate(0.5 * Math.PI);   ctx.scale(1,-1); break;
        case 6: ctx.rotate(0.5 * Math.PI);   ctx.translate(0,-height); break;
        case 7: ctx.rotate(0.5 * Math.PI);   ctx.translate(width,-height); ctx.scale(-1,1); break;
        case 8: ctx.rotate(-0.5 * Math.PI);  ctx.translate(-width,0); break;
      }

    }
    
    ctx.drawImage(image, 0, 0, width, height)
    ctx.restore()

    const backgroundColor     = 'white'
    const compositeOperation  = ctx.globalCompositeOperation
    
		ctx.globalCompositeOperation = "destination-over"

		ctx.fillStyle = backgroundColor
    ctx.fillRect(0,0,width,height)
    ctx.globalCompositeOperation = compositeOperation


    const resizedImage = canvas.toDataURL('image/jpeg', 0.7)
    return resizedImage
  
  }
 
  //base64 without mime type
  getBase64Size(base64 : string) {

    const slicedBase64  = base64.includes('base64') ? base64.split(',')[1] : base64

    let padding = 0
    if (slicedBase64.endsWith('==')) {
      padding = 2
    } else if (slicedBase64.endsWith('=')) {
      padding = 1
    }

    const size  = (slicedBase64.length * (0.75)) - padding
    return (size/1024)

  }

}