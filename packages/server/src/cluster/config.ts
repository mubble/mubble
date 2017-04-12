/*------------------------------------------------------------------------------
   About      : The default configuration for the platform. You must set mandatory 
                values before platform.start()
   
   Created on : Thu Apr 06 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
export interface CONFIG {

  /** Unique server name to ensure multiple servers are not started for the same function */
  SERVER_NAME  : string

  /** Platform run mode. Valid values DEV, PROD */
  RUN_MODE      : string

  /** User-id to run as. It is mandatory to use a user-id with least possible  
  permissions to restrict hackers / buggy code to gain undue access to the system */
  RUN_AS        : string

  /** (optional) 
    DEV  mode: defaults to 1
    PROD mode: defaults to total number of CPU cores */

  INSTANCES    ?: number

}