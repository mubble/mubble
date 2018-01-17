/*------------------------------------------------------------------------------
   About      : Typescript Typings for Mammmoth
   
   Created on : Mon Jan 15 2018
   Author     : Christy George
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {RunContextNcServer}                      from '../../framework'
export const mammoth  : any = require('mammoth')

// Reference: node_modules/mammoth/lib/document.js => Should Ideally create a @types/mammoth

export interface MTransformCbT { // Callback for Mammoth Transformation Processing 
  (rc: RunContextNcServer, element: MParagraph): MParagraph
}

export type MOptions = {
  includeDefaultStyleMap : boolean,
  transformDocument: MTransformCbT,
  styleMap: Array<string>
}

export enum MType {
  document          = "document",
  paragraph         = "paragraph",
  run               = "run",
  text              = "text",
  tab               = "tab",
  hyperlink         = "hyperlink",
  noteReference     = "noteReference",
  image             = "image",
  note              = "note",
  commentReference  = "commentReference",
  comment           = "comment",
  table             = "table",
  tableRow          = "tableRow",
  tableCell         = "tableCell",
  "break"           = "break",
  bookmarkStart     = "bookmarkStart"
}

export type MText = {
  type  : MType.text | MType.tab
  value : string
}

export type MElementBase = {
  type: MType,  
  children: Array<MRun>,
  styleId: string | null,
  styleName: string | null,
}

export enum MVerticalAlignment {
  baseline    = "baseline",
  superscript = "superscript",
  subscript   = "subscript"
};

export type MRun = MElementBase & {
  isBold: boolean,
  isUnderline: boolean,
  isItalic: boolean,
  isStrikethrough: boolean,
  isSmallCaps: boolean,
  verticalAlignment: MVerticalAlignment,
  fontSize: Number,
  fontColor: string,
  font: string
}

export type MParagraph = MElementBase & {
  numbering: string | null,
  alignment: string | null,
  indent: {
      start: string | null,
      end: string | null,
      firstLine: string | null,
      hanging: string | null
  }
}
