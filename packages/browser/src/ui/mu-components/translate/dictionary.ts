/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Wed Aug 30 2017
   Author     : Sid
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { LANG_EN_TRANS } from './lang-en'
import { LANG_HI_TRANS } from './lang-hi'
import { LANG_KN_TRANS } from './lang-kn'
import { Mubble }        from '@mubble/core'

const EN = Mubble.Lang.English
const HI = Mubble.Lang.Hindi
const KN = Mubble.Lang.Kannada

export const dictionary  = {
  'en' : LANG_EN_TRANS,
  'hi' : LANG_HI_TRANS,
  'kn' : LANG_KN_TRANS
}