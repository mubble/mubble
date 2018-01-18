/*------------------------------------------------------------------------------
   About      : Use Mammoth to do parsing of .docx files
   
   Created on : Tue Jan 16 2018
   Author     : Christy George
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {RunContextServer}                        from '../rc-server'
import {mammoth, MOptions, MParagraph}           from './mammoth'

export abstract class DocxTransformerBase {
  iniitalze (rc: RunContextServer) {
    // Default => Do Nothing
  }
  abstract transformDocParagraph(rc: RunContextServer, paragraph: MParagraph) : MParagraph;
  terminate (rc: RunContextServer) {
    // Default => Do Nothing
  }
}

export class DocxProcessor {

  static async transform(rc: RunContextServer, filename: string, transformer : DocxTransformerBase) {
    var mammoth_options : MOptions = {
      includeDefaultStyleMap : true,
      transformDocument: mammoth.transforms.paragraph(transformer.transformDocParagraph.bind (transformer, rc)),
      styleMap: [
          "i => strong", // Default = 'em'
          "p[style-name='Nudi'] => p.nudi"
      ]
    } 
    transformer.iniitalze (rc)
    const htmlDoc = await mammoth.convertToHtml({path: filename}, mammoth_options)
    // console.log ('Html Doc:', htmlDoc)
    transformer.terminate (rc)
    return (htmlDoc) ? true : false
  }
}