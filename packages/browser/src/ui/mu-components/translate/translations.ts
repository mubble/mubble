/*------------------------------------------------------------------------------
   About      : Provider for translations
   
   Created on : Tue Jul 04 2017
   Author     : Sid
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { InjectionToken }   from '@angular/core'
import { muDictionary }     from './mu-dictionary'


export const TRANSLATIONS = new InjectionToken('translations')

export const TRANSLATION_PROVIDERS = [
  { provide: TRANSLATIONS, useValue: muDictionary },
]

export function getTranslationProviders(dictionary) {
  return { provide: TRANSLATIONS, useValue: mergeDictionaries(muDictionary, dictionary) }
}

function mergeDictionaries(muDictionary, dictionary) {
  Object.keys(muDictionary).forEach((key) => {
    const value = muDictionary[key]
    if (dictionary[key]) muDictionary[key] = Object.assign(value, dictionary[key])
  })
  
  return muDictionary
}
