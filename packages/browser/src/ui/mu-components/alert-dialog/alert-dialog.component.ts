import { Component,
         Inject }             from '@angular/core'
import { InjectionCaller, 
         InjectionParent, 
         ModalInterface}      from '../injection-interface'
import { TrackableScreen }    from '../../../ui/router/trackable-screen'
import { ComponentRoutes }    from '../../router/shared-router-constants'
import { RunContextBrowser }  from '../../../rc-browser'

 
export interface AlertDialogParams {
  title            : string
  message          : string
  positiveActText  : string
  negativeActText ?: string
  contextId       ?: string //If same component is invoking this dialog with different contexts
  canGoBack       ?: boolean
  showCloseBtn    ?: boolean
  positiveLink    ?: string
}

export enum RESULT {
  YES = 'YES',
  NO  = 'NO'
}

export interface AlertDialogResult {
  result        : RESULT
  contextId ?   : string
  positiveLink ?: string
}

@Component({
  selector    : 'app-alert-dialog',
  templateUrl : './alert-dialog.component.html',
  styleUrls   : ['./alert-dialog.component.scss']
})


export class AlertDialogComponent extends TrackableScreen implements ModalInterface {

  private caller    : InjectionCaller
  private myParent  : InjectionParent
  private result    : RESULT
  private contextId : string
  private allowBack : boolean

  showCloseBtn    : boolean
  title           : string
  message         : string
  positiveActText : string
  negativeActText : string
  positiveLink    : string

  constructor(@Inject('RunContext') protected rc  : RunContextBrowser) { 
    super(rc)
    
  }

  getWidth() {
    return '80vw'
  }

  getRouteName() {
    return ComponentRoutes.Alert
  }

  isUserVisited() {
    return true
  }


  /*=====================================================================
                                  CALLBACKS
  =====================================================================*/
  setParam(queryParams : any) {
    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), queryParams['title'] && queryParams['message'] &&
    queryParams['positiveActText'], `missing queryparams ${queryParams}`)
    this.title            = queryParams['title']
    this.message          = queryParams['message']
    this.positiveActText  = queryParams['positiveActText']
    this.negativeActText  = queryParams['negativeActText'] || ''
    this.contextId        = queryParams['contextId'] || ''
    this.allowBack        = queryParams['canGoBack']
    this.showCloseBtn     = queryParams['showCloseBtn'] || false
    this.positiveLink     = queryParams['positiveLink']
  }

  setCaller(caller: InjectionCaller) {
    this.caller = caller
  }

  initFromParent(ip: InjectionParent, showTitle: boolean) {
    this.myParent = ip
  }

  close() {
    this.myParent.close()
  }

  closeFromParent() {
    const result : AlertDialogResult = {
      result      : this.result,
      contextId   : this.contextId,
      positiveLink: this.positiveLink
    }
    this.caller.setResult(this.getRouteName(), result)
  }

  isNotDismissable() {
    return true
  }

  canGoBack() {
    const canGoBack = this.allowBack !== undefined

    return canGoBack ? this.allowBack : true

  }

  /*=====================================================================
                              HTML FUNCTIONS
  =====================================================================*/
  onCancel() {
    this.result  = RESULT.NO
    this.close()
  }

  onContinue() {
    this.result     = RESULT.YES
    this.allowBack  = true
    this.close()
  }
  
}
