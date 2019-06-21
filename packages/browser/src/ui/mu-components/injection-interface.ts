/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Fri Jun 23 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
export const INJECTION_PARAM = {
  CALLER  : 'caller',
  INJECT  : 'inject'
}

export interface InjectionCaller {
  setResult(calleeId: string, result: any)
}

export interface InjectionParent {
  close(): void
}

export interface InjectedChild {
  initFromParent?(ip: InjectionParent, showTitle: boolean): void
  setCaller?(caller: InjectionCaller): void
  setParam?(params: object) : void 
  closeFromParent?()        : void
  ngOnDestroy?()            : void
  canGoBack?()              : boolean
}

export interface BottomInInterface extends InjectedChild {
  getHalfHeight()     : number
  getTitle()          : string
  getDefaultState?()  : any
}

export interface ModalInterface extends InjectedChild {
  getWidth()           : string
  isNotDismissable?()  : boolean
  onBackPressed?()     : void
}