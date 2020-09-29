import { DISPLAY_TYPE } from '@mubble/core'

export interface OutputParams {
  id          : string
  value       : any
  displayType : DISPLAY_TYPE
}

export interface FormOutputValue {
  value       : any
  displayType : DISPLAY_TYPE
}

export interface MuFormOutputParams {
  [key : string] : FormOutputValue
}