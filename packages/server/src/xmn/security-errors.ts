/*------------------------------------------------------------------------------
   About      : Error Codes Enum
   
   Created on : Mon Dec 31 2018
   Author     : Vishal Sinha
   
   Copyright (c) 2018 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

export enum SecurityError {
  INVALID_CLIENT,
  INVALID_VERSION,
  INVALID_REQUEST_TS,
  INVALID_ENCODING,
  INVALID_REQUEST_METHOD,
  REQUEST_REPLAY
}

export const SecurityErrorCodes = {
  INVALID_CLIENT         : 'INVALID_CLIENT',
  INVALID_VERSION        : 'INVALID_VERSION',
  INVALID_REQUEST_TS     : 'INVALID_REQUEST_TS',
  INVALID_ENCODING       : 'INVALID_ENCODING',
  INVALID_REQUEST_METHOD : 'INVALID_REQUEST_METHOD',
  REQUEST_REPLAY         : 'REQUEST_REPLAY'
}