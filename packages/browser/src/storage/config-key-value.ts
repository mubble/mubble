import { RunContextBrowser }  from '..'
import { StorageProvider }    from '.'
import { Mubble }             from '../../core'

export class ConfigKeyVal {

  constructor(private rc: RunContextBrowser, private storage: StorageProvider) {}

  async setConfig(config: {category: string, key: string, value: Mubble.uObject<string>}[]) {
    await this.storage.setGcConfig(this.rc, config)
  }

  async getConfig(category: string, key: string): Promise<Mubble.uObject<string>> {

    const value = await this.storage.getGcConfig(this.rc, category, key)
    if (!value) {
      this.rc.isWarn() && this.rc.warn(this.rc.getName(this), 
        `No config found for category ${category}, key ${key}`)
      return null
    }
    return JSON.parse(value)
  }

}