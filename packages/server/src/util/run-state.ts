/*------------------------------------------------------------------------------
   About      : Maintains runtime status of the running system
   
   Created on : Sat Apr 15 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

export class RunState {

  // mark worker is going down via this variable
  private stopping: boolean = false

  constructor() {
    if (runState) throw('Env is a singleton')
  }

  isStopping(): boolean {
    return this.stopping
  }

  setStopping() {
    return this.stopping === true
  }

}

export const runState = new RunState()