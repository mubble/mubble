import { RunContextBrowser }                                from "../../.."
import { TranslateService }                                 from ".."

export enum API_STATE {
  PROGRESS = 1,
  ERROR,
  ERROR_NO_DATA,
  SUCCESS
}

export class ApiState {

  currentState    : API_STATE
  loadingText     : string
  emptyDataText   : string
  errorText       : string

  retryButtonText : string
  retryOnFailure  : boolean = false
  errorCode       : string

  constructor(private rc        : RunContextBrowser, 
              private translate : TranslateService) {

    this.loadingText      = translate.instant('cmn_loading')
    this.errorText        = translate.instant('cmn_toast_err_unknown')
    this.retryButtonText  = translate.instant('cmn_btn_retry')
  }
}

export class ApiStateBuilder {

  private instance: ApiState

  constructor(private rc        : RunContextBrowser, 
              private translate : TranslateService) {

    this.instance = new ApiState(rc, translate)
  }

  setCurrentState(state: API_STATE): ApiStateBuilder {
    this.instance.currentState = state
    return this
  }

  setLoadingText(text: string): ApiStateBuilder {
    this.instance.loadingText = text
    return this
  }
  setEmptyDataText(text: string): ApiStateBuilder {
    this.instance.emptyDataText = text
    return this
  }
  setErrorText(text: string): ApiStateBuilder {
    this.instance.errorText = text
    return this
  }

  setRetryButtonText(text: string): ApiStateBuilder {
    this.instance.retryButtonText = text
    return this
  }

  retryOnFailure() {
    this.instance.retryOnFailure = true
    return this
  }

  setErrorCode(code: string): ApiStateBuilder {
    this.instance.errorCode = code
    return this
  }

  build(): ApiState {
    return this.instance
  }

}