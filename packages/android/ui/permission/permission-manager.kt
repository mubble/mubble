package `in`.mubble.android.ui.permission

import `in`.mubble.android.ui.MubbleBaseActivity
import `in`.mubble.newschat.R
import `in`.mubble.newschat.utils.AndroidBase
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import android.support.annotation.NonNull
import android.support.v4.app.ActivityCompat
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.widget.Button
import android.widget.TextView
import org.jetbrains.anko.find
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

    val builder     = AlertDialog.Builder(activity, R.style.PermissionDialog)
    val dialogView  = LayoutInflater.from(activity).inflate(R.layout.prm_rationale_dialog, null)
    builder.setView(dialogView)

    val dialog = builder.create()
    dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)

    if (groups.size == 1) {
      val rationaleDesc : TextView = dialogView.find(R.id.prm_rtnl_desc)
      rationaleDesc.visibility = View.VISIBLE
      rationaleDesc.text = AndroidBase.fromHtml(groups.first().getRationaleText())

    } else {
      val rationaleCont : ViewGroup = dialogView.find(R.id.prm_rtnl_cont)
      rationaleCont.visibility = View.VISIBLE
      for (groupPerm in groups) {
        val bulletView = LayoutInflater.from(activity).inflate(R.layout.prm_rationale, rationaleCont, false)
        bulletView.find<TextView>(R.id.cmn_bullet_text).text = groupPerm.getRationaleText()
        rationaleCont.addView(bulletView)
      }
    }

    val posBtn : Button = dialogView.find(R.id.prm_rtnl_pos_btn)
    val negBtn : Button = dialogView.find(R.id.prm_rtnl_neg_btn)

    val perms = mutableListOf<String>()
    for (groupPerms in groups) perms.addAll(groupPerms.getPermissionGroup().groupPermissions)

    posBtn.setOnClickListener {
      ActivityCompat.requestPermissions(activity, perms.toTypedArray(), APP_PERMISSIONS_REQ_CODE)
      dialog.dismiss()
    }

    negBtn.setOnClickListener {
      //activity.toast(R.string.prm_rationale_toast)
      requestPending = false
      cb(groups, true, false)
      dialog.dismiss()
    }

    dialog.show()
    val width     = AndroidBase.calculate(90, AndroidBase.getScreenWidth(activity))
    val params    = dialog.window!!.attributes
    params.width  = width
    dialog.window!!.attributes = params
  }

  private fun showPermSettingDialog() {

    val builder = AlertDialog.Builder(activity, R.style.PermissionDialog)
    builder.setMessage(R.string.cmn_perm_rationale_go_to_settings)
        .setPositiveButton(R.string.cmn_text_give_perm) { _, _ ->

          val myApp = Uri.parse("package:" + activity.packageName)
          val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, myApp)
          intent.addCategory(Intent.CATEGORY_DEFAULT)
          intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
          activity.startActivity(intent)
          //activity.toast(R.string.cch_toast_app_permit)
        }
        .setNegativeButton(R.string.cmn_text_later) { _, _ ->
          //activity.toast(R.string.cch_toast_permit_proceed)
        }.create().show()
  }
}
