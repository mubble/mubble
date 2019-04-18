import { Mubble, 
         expandTemplate,
         expandTemplateObj,
         XmnError
       }                        from '../../core'
import { UrlHelper }            from './url-helper'

export class BaseUtility {

  expandTemplate(template: string, data: Mubble.uObject<any>): string {
    return expandTemplate(template, data)
  }

  expandTemplateObj(templateObj: any, data: Mubble.uObject<any>): any {
    return expandTemplateObj(templateObj, data)
  }
  
  parseURLForRouter(parser: any) {

    if (parser.protocol !== 'http') {
      parser.href = parser.href.replace(/.*\:\/\//, 'http://')
    }

    let queries       = parser.search.replace(/^\?/, '').split('&'),
        searchObject  = {}

    for(let i = 0; i < queries.length; i++ ) {
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

  getCompressedImage(file : any) {

    return new Promise((resolve, reject) => {
      
      let resizedImage

      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (readerEvent : any) => {

        const image = new Image()
        image.src = readerEvent.target.result
        
        image.onload = (imageEvent : any) => {

          const canvas  = document.createElement('canvas'),
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

          canvas.getContext('2d').drawImage(image, 0, 0, width, height)
          resizedImage = canvas.toDataURL('image/jpeg', 0.7)
          resolve(resizedImage)
        }
      }
      reader.onerror = error => reject(error)
    })
  }



}