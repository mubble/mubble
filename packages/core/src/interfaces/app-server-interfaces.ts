/*------------------------------------------------------------------------------
   About      : Interfaces for mubble core components that are used by both
                app and server

   Created on : Fri Jan 03 2019
   Author     : Yaswanth Shankar
   
   Copyright (c) 2018 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

export enum COL_TYPE  {
  ICON         = 'ICON',
  IMAGE        = 'IMAGE',
  BUTTON       = 'BUTTON',
  TEXT         = 'TEXT',
  EDIT         = 'EDIT',
  TOGGLE       = 'TOGGLE',
  HYPER_LINK   = 'HYPER_LINK',
  MORE_DETAILS = 'MORE_DETAILS',
  MULTI_LINE   = 'MULTI_LINE',
  INPUT_EDIT   = 'INPUT_EDIT'
}

export interface PipeParams {
  pipeName   : string
  value     ?: any
}

export interface NavInfo {
  pageTitle?: string
  logName   : string 
  navUrl    : string
  btnName  ?: string
  rootNav  ?: boolean
}

export interface TableHeader {
  header        : string
  dataKey      ?: string
  colType       : COL_TYPE 
  pipeParams   ?: PipeParams
  pipeParmas   ?: PipeParams
  customStyle  ?: string
  constValue   ?: any
  enableSort   ?: boolean
  widthPerc    ?: number
  isEditable   ?: boolean
  multiLineKey ?: string[] // It takes input as image text and icon
  dataKeyType  ?: string[] // it consists of the COL_TYPE of keys in multiLineKey
  dataKeyArr   ?: string[] // when multiLineKey has text it consists of the array of dataKeys to be displayed in multiple rows
  headerArr    ?: string[] // It consists of the header part of the corresponding datakeys in dataKeyArr
  elementStyle ?: string
  navInfo      ?: NavInfo
}

export interface FilterItem {
  params  : InputParams
  mode   ?: FILTER_MODE
}

export interface InputParams {
  id               : string
  displayType      : DISPLAY_TYPE
  placeHolder      : string | string[]
  label           ?: string
  options         ?: SelectionBoxParams[]
  selectAll       ?: boolean
  inputType       ?: string
  maxLength       ?: number
  value           ?: any
  isPassword      ?: boolean
  validators      ?: ValidatorsParams
  isRequired      ?: boolean
  isDisabled      ?: boolean
  image           ?: FilterImage
  requiredIf      ?: string
  disabledIf      ?: string
  withoutBorder   ?: boolean
  sectionIds      ?: string[]
  autoComplete    ?: string
  name            ?: string
  format          ?: string
  maskLength      ?: number
  isVisible       ?: boolean
  rangeKeys       ?: string[]
}

export interface MuFomrValidation {
  validation  : any[]
  errorMsg    : string
}


export interface MuFormValidation {
  validation  : any[]
  errorMsg    : string
}

export interface MuFormParams {
  inputParams     : InputParams[]
  formValidators ?: MuFormValidation | MuFomrValidation
}

export enum DISPLAY_TYPE {
  ROW_INPUT_BOX         = 'ROW_INPUT_BOX',
  INPUT_BOX             = 'INPUT_BOX',
  SELECTION_BOX         = 'SELECTION_BOX',
  CALENDAR_BOX          = 'CALENDAR_BOX',
  DATE_RANGE            = 'DATE_RANGE',
  NUMBER_RANGE          = 'NUMBER_RANGE',
  AUTOCOMPLETE_SELECT   = 'AUTO_COMPLETE_SELECT',
  RADIO                 = 'RADIO',
  ROW_RADIO             = 'ROW_RADIO',
  TEXT_AREA             = 'TEXT_AREA',
  IMAGE_UPLOAD          = 'IMAGE_UPLOAD',
  TOGGLE                = 'TOGGLE',
  MULTI_CHECK_BOX       = 'MULTI_CHECK_BOX',
  BUTTON_TOGGLE         = 'BUTTON_TOGGLE',
  SLIDER                = 'SLIDER',
  TIME                  = 'TIME'
}

export interface SelectionBoxParams {
  id        : string | number
  value     : string | number 
  selected ?: boolean
}

export interface ValidatorsParams {
  allowFutureDate    ?: boolean
  rangeInputsReqd    ?: boolean // will be removed in future releases
  validation         ?: string | RegExp
  validationError     : string
}

export enum DISPLAY_MODE {
  HORIZONTAL = 'HORIZONTAL',
  VERTICAL   = 'VERTICAL'
}

export interface ImageParams {
  imgUrl    ?: string
  iconClass ?: string
}

export interface FilterImage {
  prefixParams ?: ImageParams
  suffixParams ?: ImageParams
}

export enum FILTER_MODE {
  SEARCH = 'SEARCH',
  MATCH  = 'MATCH',
  RANGE  = 'RANGE',
  SORT   = 'SORT'
}

export enum SORT_MODE {
  ASC  = 'ASC',
  DESC = 'DESC'
}

export interface FilterParams {
  mode   : FILTER_MODE
  params : {[key: string] : string}
}

//TODO - to be verified
export interface MuSelectedFilter {
  id           : string,
  mode         : FILTER_MODE,
  value        : any
  displayType ?: DISPLAY_TYPE
  displayMode ?: DISPLAY_MODE
}
