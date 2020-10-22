import { Permission, 
         BROWSER_PERM 
       }                          from './native-constants'
import { RunContextBrowser }      from '../../rc-browser'
import { LOG_LEVEL }              from '@mubble/core'

export class MuWebApi {


  constructor(protected rc : RunContextBrowser) {}

  async hasPermission(permission : Permission) : Promise<boolean> {
    return await this.checkPermission(permission)
  }

  async checkPermission(permission : Permission) {

    switch (permission) {

      case BROWSER_PERM.CAMERA: 

        const permissionStatus = await (navigator as any).permissions.query({ name: 'camera' })
        return (permissionStatus.state === 'granted')

      case BROWSER_PERM.GALLERY:
        return true

      default:
        if (this.rc.getGlobalLogLevel() !== LOG_LEVEL.NONE)
        this.rc.uiRouter.showToast(`${permission} permission to be implemented`)
        return true
    }
  }

  async getPermission(permission : Permission) : Promise<boolean> {
    switch (permission) {
      case BROWSER_PERM.CAMERA: 
        try {
          await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          return true
        } catch(err) {
          return false
        }

      case BROWSER_PERM.GALLERY:
        return true
    }
  }

  async getPictureFromCamera() {

    // return await this.rc.uiRouter.getRoot().captureWebCamera()
    return {} as unknown

  }

}
