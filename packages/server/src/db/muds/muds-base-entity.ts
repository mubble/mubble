/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Wed May 16 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
const datastore : any = require('@google-cloud/datastore')

import {  GcloudEnv }         from '../../gcp/gcloud-env'

import {  RunContextServer  } from '../../rc-server'
import * as lo                from 'lodash'
import { Mubble }             from '@mubble/core';

export abstract class MudsBaseEntity {

  private editing     : boolean  // indicates editing is undergoing for this entity
  private savePending : boolean  // indicates that entity is pending to be saved
  private isFromDs    : boolean  // indicates that entity has either been fetched from db Or was created new and then inserted into db
  

}

