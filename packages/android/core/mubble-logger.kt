package `in`.mubble.android.core

import org.jetbrains.anko.AnkoLogger

/*------------------------------------------------------------------------------
   About      : A simple override on AnkoLogger to have some control over logging
   
   Created on : 01/12/17
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const val suffix    = ":::"
const val tagLength = 23 - suffix.length

interface MubbleLogger : AnkoLogger {

  // Please override this to have custom value of your tag
  val customTag: String
    get() = ""

  // Don't override this, it is like 'final'
  override val loggerTag: String
    get() = computeTag(javaClass)


  private fun computeTag(clazz: Class<*>): String {
    val tag = if (customTag === "") clazz.simpleName else customTag
    return if (tag.length <= tagLength) {
      tag
    } else {
      tag.substring(0, tagLength)
    } + suffix
  }

}