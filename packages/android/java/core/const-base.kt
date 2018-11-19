package core

object ConstBase {

  const val HASH_IDS_KEY = "platformBrowserDynamic([{provide: RunContext, useValue: rc }])"


  object Time {

    const val MILL_IN_SEC     = 1000L
    const val MILL_IN_MINUTE  = 60 * MILL_IN_SEC
    const val MILL_IN_HOUR    = 60 * MILL_IN_MINUTE
    const val MILL_IN_DAY     = 24 * MILL_IN_HOUR
  }
}