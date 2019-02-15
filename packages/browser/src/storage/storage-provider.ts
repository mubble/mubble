import { RunContextBrowser }  from ".."
import { Mubble }             from "../../core"

const GLOBAL_PREFIX = 'global',
      CONFIG_PREFIX = 'config'

export class StorageProvider {

  setGlobalKeyValue(rc: RunContextBrowser, key: string, value: string) {
    const storageKey = GLOBAL_PREFIX + '.' + key
    localStorage.setItem(storageKey, value)
  }

  async getGlobalKeyValue(rc: RunContextBrowser, key: string): Promise<string> {
    const storageKey = GLOBAL_PREFIX + '.' + key
    return localStorage.getItem(storageKey)
  }

  setUserKeyValue(rc: RunContextBrowser, key: string, value: string) {
    localStorage.setItem(key, value)
  }

  async getUserKeyValue(rc: RunContextBrowser, key: string): Promise<string> {
    return localStorage.getItem(key)
  }

  setGcConfig(rc: RunContextBrowser, config: {category: string, key: string, value: Mubble.uObject<string>}[]) {

    config.forEach((entry) => {
      const storageKey = `${CONFIG_PREFIX}.${entry.category}|${entry.key}`
      localStorage.setItem(storageKey, JSON.stringify(entry.value))

      // if (rc && rc.isDebug) {
      //   rc.isDebug() && rc.debug('GcConfigKeyValue', 
      //     `Saved key ${storageKey}=${JSON.stringify(entry.value)}`)
      // }
    })
  }

  async getGcConfig(rc: RunContextBrowser, category: string, key: string): Promise<string> {

    const storageKey = `${CONFIG_PREFIX}.${category}|${key}`
    return localStorage.getItem(storageKey)
  }

}