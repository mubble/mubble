package ui.permission

import android.content.pm.PackageManager
import android.support.annotation.NonNull
import android.support.v4.app.ActivityCompat
import ui.base.MubbleBaseActivity
import java.util.*

/**
 * Created by
 * siddharthgarg on 30/11/17.
 */

class AskedPermission(private val permissionGroup : PermissionGroup,
                      private val rationaleText   : String) {

  fun getPermissionGroup(): PermissionGroup = permissionGroup

  fun getRationaleText(): String = rationaleText
}

class PermissionManager(private val activity      : MubbleBaseActivity,
                        private val showRationale : Boolean,
                        private val cb            : (MutableSet<AskedPermission>, Boolean, Boolean) -> Unit) {

  private val askedPerms = mutableSetOf<AskedPermission>()

  private var requestTime     : Long    = -1
  private var requestPending  : Boolean = false

  companion object {

    private const val APP_PERMISSIONS_REQ_CODE = 1
  }

  fun askAppPermissions(askedPerms : MutableSet<AskedPermission>) {

    if (requestPending) return
    requestPending = true

    this.askedPerms.addAll(askedPerms)

    var canShowRationale  = false
    val wantedPerms       = mutableSetOf<AskedPermission>()
    val perms             = mutableListOf<String>()

    for (perm in askedPerms) {
      val group = perm.getPermissionGroup()
      if (!group.hasPermission(activity)) {
        wantedPerms.add(perm)
        perms.addAll(group.groupPermissions)
        if (group.shouldShowRationale(activity)) canShowRationale = true
      }
    }

    if (wantedPerms.isEmpty()) {
      cb(askedPerms, false, true)
      return
    }

    if (canShowRationale && showRationale) {
      showRationaleDialog(wantedPerms)

    } else {
      this.requestTime = Calendar.getInstance().timeInMillis
      ActivityCompat.requestPermissions(activity, perms.toTypedArray(), APP_PERMISSIONS_REQ_CODE)
    }
  }

  fun onRequestPermissionsResult(@NonNull permissions: Array<String>, @NonNull grantResults: IntArray) {

    val dialogShown = requestTime + 500 < Calendar.getInstance().timeInMillis

    requestPending = false

    var canShowRationaleDialog = false

    val grantedGroups  = mutableSetOf<AskedPermission>()
    val rejectedGroups = mutableSetOf<AskedPermission>()

    for (i in grantResults.indices) {
      val grantResult = grantResults[i]
      val group       = PermissionGroup.getGroup(permissions[i])!!
      var askedGroup: AskedPermission? = null

      askedPerms
          .filter { it.getPermissionGroup() == group }
          .forEach { askedGroup = it }

      if (grantResult == PackageManager.PERMISSION_GRANTED) {
        grantedGroups.add(askedGroup!!)

      } else {
        canShowRationaleDialog = canShowRationaleDialog || group.shouldShowRationale(activity)
        rejectedGroups.add(askedGroup!!)
      }
    }

    if (rejectedGroups.isEmpty()) {
      cb(askedPerms, dialogShown, true)
      return
    }

    when {
      canShowRationaleDialog -> {
        if (this.showRationale) {
          showRationaleDialog(rejectedGroups)
        } else {
          requestPending = false
          cb(rejectedGroups, dialogShown, false)
        }
      }
      requestTime + 500 > Calendar.getInstance().timeInMillis -> showPermSettingDialog()
      //else -> activity.toast(R.string.prm_rationale_toast)
    }
  }

  private fun showRationaleDialog(groups: MutableSet<AskedPermission>) {

    activity.showRationaleDialog(groups) { action: Boolean ->

      if (action) {
        requestPending = false
        cb(groups, true, false)

      } else {
        val perms = mutableListOf<String>()
        for (groupPerms in groups) perms.addAll(groupPerms.getPermissionGroup().groupPermissions)
        ActivityCompat.requestPermissions(activity, perms.toTypedArray(), PermissionManager.APP_PERMISSIONS_REQ_CODE)
      }
    }
  }

  private fun showPermSettingDialog() {
    activity.showPermSettingDialog()
  }
}
