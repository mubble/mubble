
export const TIME = {
  MILL_IN_SEC    : 1000,
  MILL_IN_MINUTE : 60 * 1000,
  MILL_IN_HOUR   : 60 * 60 * 1000,
  MILL_IN_DAY    : 24 * 60 * 60 * 1000
}

export const TYPEOF = {
  STRING : 'string',
  NUMBER : 'number'
}

export interface VerificationSettings  {
  startTs : number,
  numbers : {[key: string] : VerificationNumber }
}

export interface VerificationNumber {
  clTrId    : string,
  attempts  : number
}

export const VerificationSettingsExp = {
  TIME_DEBUG : 5 * 60 * 1000,
  TIME_PROD  : 60 * 60 * 1000
}

export const VerificationError = {

  ERR_INTERNET       : 'ERR_INTERNET',
  ERR_INVALID_NUM    : 'ERR_INVALID_NUM',
  ERR_NUM_LIMIT      : 'ERR_NUM_LIMIT',
  ERR_ATTEMPTS_LIMIT : 'ERR_ATTEMPTS_LIMIT',
  ERR_TIMEOUT        : 'ERR_TIMEOUT',
  ERR_NONE           : 'ERR_NONE',
  ERR_MSISDN_FAIL    : 'ERR_MSISDN_FAIL'
}

export const GcCategory = {
  Notification      : 'NOTIFICATION',
  FeedbackEmail     : 'FEEDBACK_EMAIL',
  SmsVerification   : 'SMS_VERIFICATION',
  Help              : 'HELP',
  Session           : 'SESSION'
}

export const FcCategory = {
  Help    : 'HELP',
  Session : 'SESSION'
}

export const GcKey = {
  GeneralConfig       : 'GENERAL_CONFIG',
  FeedbackEmail       : 'FEEDBACK_EMAIL'
}

export const FcKey  = {
  GeneralConfig : 'GENERAL_CONFIG',
  UiConfig      : 'UI_CONFIG'
}

export const GcValue = {

  FeedbackEmail : {

    email   : 'email', 
    topics  : 'topics',

    topicsValue : {
      privacy       : 'privacy',
      default       : 'default',
      notification  : 'notification',
      settings      : 'settings',
      createStance  : 'createStance'
    }
  },

  Help : {

    customerCareNo : 'custCareNo'
  }
}

export interface SessionGC {
  bgTimeoutSec    : number
  fgTimeoutSec    : number
}


export interface UiFlavourConfig {
  w2bActive       : boolean
  isVeri5Enabled  : boolean
}

export interface HelpFlavourConfig {
  custCareEmail   : string
  custCareNo      : string
}


export const HashidParams = {
  LogLevel        : '__logLevel',
  DisableCaptcha  : '__disableCaptcha'
}

export interface Color {
  name          : string
  hex           : string
  darkContrast  : boolean
}


export type EnvConfig = {
  staticUrlPrefix : string
}