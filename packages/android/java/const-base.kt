object ConstBase {

  const val HASH_IDS_KEY = "platformBrowserDynamic([{provide: RunContext, useValue: rc }])"

  object Firebase {

    const val SESSION_ID            = "session_id"
    const val UPGRADE_PING          = "upgrade_ping"
    const val FILE_CORRUPT_UPGRADE  = "upgrade_corrupted"
  }

  object InternalStorage {

    const val MANIFEST = "manifest.json"
    const val VERSION_NAME = "versionName"

    object Code {

      const val NAME = "code"
      const val WEB_FILE = "index.html"
      const val MANIFEST_NAME = MANIFEST
      const val VERSION = VERSION_NAME
    }

    object Upgrade {

      const val NAME = "upgrade"
      const val MANIFEST_NAME = MANIFEST
      const val SUCCESS = "success"
      const val VERSION = VERSION_NAME
    }

    object Users {

      const val NAME = "users"
    }

    object Cache {

      const val NAME = "cache"

      object AppIcons {

        const val APP_ICONS = "appIcons"
      }
    }
  }

  object Time {

    const val MILL_IN_SEC     = 1000L
    const val MILL_IN_MINUTE  = 60 * MILL_IN_SEC
    const val MILL_IN_HOUR    = 60 * MILL_IN_MINUTE
    const val MILL_IN_DAY     = 24 * MILL_IN_HOUR
  }
}