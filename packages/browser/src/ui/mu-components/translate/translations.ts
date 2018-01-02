/*------------------------------------------------------------------------------
   About      : Provider for translations
   
   Created on : Tue Jul 04 2017
   Author     : Sid
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { InjectionToken } from '@angular/core'
import { dictionary } from "./dictionary"

export const TRANSLATIONS = new InjectionToken('translations')

export const TRANSLATION_PROVIDERS = [
    { provide: TRANSLATIONS, useValue: dictionary },
];