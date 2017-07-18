/*------------------------------------------------------------------------------
   About      : Common interface for master data sync
   
   Created on : Tue Jul 18 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

/*------------------------------------------------------------------------------
  Here are the changes wrt prepaid structure:

  1) The _id concept is gone from the db, hence all individual keys are sent. Del
     array would always key name preceeding the key value.

  2) Few fields are named differently like sync_hash is just hash

  3) Response only sends sync hash of modified data structures

  4) Please note all the modified structures

------------------------------------------------------------------------------*/

export const Segment = {
  version: 'version'
}

// ----------- shared between request and response data structures -----------


/**
 * 
 * A brief description of segment data structure:
 * An app installation subscribes to multiple segment names. Each segment can
 * have multiple values. These are best understood with the structure below
 * 
 * operator segment [['AT'], ['VF']]
 * opcr     segment [['AT','KA'], ['VF', 'KA']]
 * version  segment [['1.0.4']] // only one version can be installed
 */
export type SegmentType = any[][] 


export interface SyncHashModel {
  ts      : number
  seg    ?: SegmentType // a model can use only one segment
}

export interface SyncHashModels {
  [modelName: string]: SyncHashModel
}

// --------- data structures used by client to send a request -----------
export interface Segments {
  [segName: string]: SegmentType
}

export interface SyncRequest {
  segments  : Segments
  hash      : SyncHashModels
}

// --------- data structures used by server to send a response -----------
export interface SyncModelResponse {
  mod       : object[]
  del       : object[]
  purge    ?: boolean
  hash      : SyncHashModel
}

export interface SyncResponse {
  [modelName: string]: SyncModelResponse 
}
