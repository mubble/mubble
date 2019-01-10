/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Tue Apr 24 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as doT from 'dot'
import { Mubble } from '../mubble'

// const dotSettings = {
//   evaluate: /<([\s\S]+?)>/g,
//   interpolate: /<=([\s\S]+?)>/g,
//   encode: /<!([\s\S]+?)>/g,
//   use: /<#([\s\S]+?)>/g,
//   useParams: /(^|[^\w$])def(?:\.|\[[\'\"])([\w$\.]+)(?:[\'\"]\])?\s*\:\s*([\w$\.]+|\"[^\"]+\"|\'[^\']+\'|\{[^\}]+\})/g,
//   define: /<##\s*([\w\.$]+)\s*(\:|=)([\s\S]+?)#>/g,
//   defineParams: /^\s*([\w$]+):([\s\S]+)/,
//   conditional: /<\?(\?)?\s*([\s\S]*?)\s*>/g,
//   iterate: /<~\s*(?:>|([\s\S]+?)\s*\:\s*([\w$]+)\s*(?:\:\s*([\w$]+))?\s*>)/g,
//   varname: 'it',
//   strip: false,
//   append: true,
//   selfcontained: false
// }

const dotSettings = {
  evaluate:    /\{\{([\s\S]+?)\}\}/g,
  interpolate: /\{\{=([\s\S]+?)\}\}/g,
  encode:      /\{\{!([\s\S]+?)\}\}/g,
  use:         /\{\{#([\s\S]+?)\}\}/g,
  useParams:   /(^|[^\w$])def(?:\.|\[[\'\"])([\w$\.]+)(?:[\'\"]\])?\s*\:\s*([\w$\.]+|\"[^\"]+\"|\'[^\']+\'|\{[^\}]+\})/g,
  define:      /\{\{##\s*([\w\.$]+)\s*(\:|=)([\s\S]+?)#\}\}/g,
  defineParams: /^\s*([\w$]+):([\s\S]+)/,
  conditional: /\{\{\?(\?)?\s*([\s\S]*?)\s*\}\}/g,
  iterate:     /\{\{~\s*(?:\}\}|([\s\S]+?)\s*\:\s*([\w$]+)\s*(?:\:\s*([\w$]+))?\s*\}\})/g,
  varname: 'it',
  strip: true,
  append: true,
  selfcontained: false
}

export function expandTemplate(template: string, data: Mubble.uObject<any>): string {

  const fn = doT.template(template, dotSettings)
  return fn(data)
}

export function expandTemplateObj(templateObj: any, data: Mubble.uObject<any>): any {

  const keys = Object.keys(data)
  dotSettings.varname = keys.join(', ')

  const newObj = {} as any

  for (const key of Object.keys(templateObj)) {

    if (typeof templateObj[key] === 'object') {
      const childObj  = expandTemplateObj(templateObj[key], data)
      newObj[key] = childObj
    } else {
      const fn = doT.template(templateObj[key], dotSettings)
      newObj[key] = fn.apply(doT, keys.map(key => data[key]))
    }
  }
  return newObj
}
