
import { RunContextBrowser, InitConfigBrowser, RunStateBrowser } from '../public-api';




export class RunContextJest extends RunContextBrowser {

  constructor(initConfig: InitConfigBrowser, runState: RunStateBrowser, contextId?: string, contextName?: string) {
    super(initConfig, runState, contextId, contextName)
  }
  copyConstruct(contextId?: string, contextName?: string) {
    const newRc = new RunContextJest(this.initConfig, this.runState, contextId, contextName)
    this.clone(newRc)
    return newRc
  }
}
