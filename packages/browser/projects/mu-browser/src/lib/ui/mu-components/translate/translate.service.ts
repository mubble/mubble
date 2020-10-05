/*------------------------------------------------------------------------------
   About      : Single instance translation service injected on app level
   
   Created on : Tue Jul 04 2017
   Author     : Sid
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { RunContextBrowser }                    from '../../../rc-browser'
import { Injectable, 
         Inject 
       }                                        from '@angular/core'
import { TRANSLATIONS }                         from './translations'
import { Mubble }                               from '@mubble/core'

const PLACEHOLDER = '%'

@Injectable({
  providedIn : 'root'
})

export class TranslateService {

  constructor(@Inject('RunContext') private rc: RunContextBrowser, 
              @Inject(TRANSLATIONS) private _translations: any) {
 
    if (Array.isArray(this._translations)) {
      const obj = {}
      for (const translate of this._translations) {
        const keys = Object.keys(translate)
        for (const key of keys) {
          if (!obj[key]) {
            obj[key] = translate[key]
          } else {
            Object.assign(obj[key], translate[key])
          }
        }
      }
      this._translations  = obj
    } else {
      throw new Error(`Translations Error. Expected type array. Actual ${typeof this._translations} ${JSON.stringify(this._translations)}`)
    }
  }
  
  private defaultLang : string = Mubble.Lang.English
  private currentLang : string
  private fallback    : boolean = true
  
  public getCurrentLanguage() {
    return this.currentLang || this.defaultLang
  }

  public setDefaultLanguage(lang: string) {
    this.defaultLang = lang;
  }

  public enableFallback(enable: boolean) {
    this.fallback = enable;
  }
  
  public use(lang: string): void {
    this.currentLang = lang
  }

  private translate(key: string): string {

    let translation = key

    // found in current language
    if (this._translations[this.currentLang] && this._translations[this.currentLang][key]) {
      return this._translations[this.currentLang][key]
    }

    // fallback disabled
    if (!this.fallback) { 
        return translation;
    }

    // found in default language
    if (this._translations[this.defaultLang] && this._translations[this.defaultLang][key]) {
        return this._translations[this.defaultLang][key];
    }

    return translation
  }

  public addTranslations(langObj : object, lang : string) {
    Object.assign(this._translations[lang], langObj)
  }

  public instant(key: string, words?: string | string[]) { // add optional parameter

    const translation: string = this.translate(key)
    if (!words) return translation
    return this.replace(translation, words)
  }

  public replace(word: string = '', words: string | string[] = '') {

    let translation: string = word
    const values: string[] = [].concat(words)
    values.forEach((e, i) => {
        translation = translation.replace(PLACEHOLDER.concat(<any>i), e)
    })
    return translation
  }

  public addMoreTranslations(langObj : object, lang : string) {
    this._translations[lang] = {...langObj, ...this._translations[lang]}
  }
}