/*------------------------------------------------------------------------------
   About      : Use Mammoth to do parsing of .docx files
   
   Created on : Tue Jan 16 2018
   Author     : Christy George
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {RunContextNcServer}                      from '../../framework'
import {mammoth, MOptions, MParagraph}           from './mammoth'

export abstract class DocxTransformerBase {
  abstract transformDocParagraph(rc: RunContextNcServer, paragraph: MParagraph) : MParagraph;
}

export class DocxProcessor {

  static async transform(rc: RunContextNcServer, filename: string, transformer : DocxTransformerBase) {
    var mammoth_options : MOptions = {
      includeDefaultStyleMap : true,
      transformDocument: mammoth.transforms.paragraph(transformer.transformDocParagraph.bind (transformer, rc)),
      styleMap: [
          "i => strong", // Default = 'em'
          "p[style-name='Nudi'] => p.nudi"
      ]
    } 
    const htmlDoc = await mammoth.convertToHtml({path: filename}, mammoth_options)
    // console.log ('Html Doc:', htmlDoc)
    return (htmlDoc) ? true : false
  }
}