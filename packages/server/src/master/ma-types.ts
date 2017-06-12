/*------------------------------------------------------------------------------
   About      : Define all custom types for master modules
   
   Created on : Tue Jun 06 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

export type MaMap<T>    = {[key : string] : T}

export type StringValMap = MaMap<string>
export type GenValMap    = MaMap<object>

export type MasterCache  = MaMap<GenValMap>