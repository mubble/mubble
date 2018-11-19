package core

import org.json.JSONObject

/*------------------------------------------------------------------------------
   About      : 
   
   Created on : 05/12/17
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

interface JsonSerializable {

  // must define following constructor if we ever need to deserialize from JSON
  // constructor(jsonObject: JSONObject): this()

  fun toJsonObject(): JSONObject
}