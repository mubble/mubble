package `in`.mubble.android.ui.permission

import `in`.mubble.android.ui.MubbleBaseActivity
import `in`.mubble.newschat.R
import `in`.mubble.newschat.utils.AndroidBase
import android.app.AlertDialog
import android.content.pm.PackageManager
import android.support.v4.app.ActivityCompat
import android.view.LayoutInflater
import android.view.Window
import android.widget.Button
import android.widget.TextView
import org.jetbrains.anko.find
import org.jetbrains.anko.toast

/**
 * Created by
 * siddharthgarg on 30/11/17.
 */

class PermissionManager(private val activity        : MubbleBaseActivity,
                        private val askedPermGroup  : PermissionGroup,
                        private val rationaleText   : String,
                        private val cb : (PermissionGroup, Boolean) -> Unit) {

  init {

    if (askedPermGroup.shouldShowRationale(activity)) {
      showRationaleDialog(askedPermGroup)

    } else {
      ActivityCompat.requestPermissions(activity, askedPermGroup.groupPermissions,
          askedPermGroup.reqCode)
    }
  }

  fun onRequestPermissionsResult(permissions: Array<String>,
                                 grantResults: IntArray) {

    var canShowRationaleDialog = false

    val grantedGroups  = mutableSetOf<PermissionGroup>()
    val rejectedGroups = mutableSetOf<PermissionGroup>()

    for (i in grantResults.indices) {
      val grantResult = grantResults[i]
      val group       = PermissionGroup.getGroup(permissions[i])!!

      if (grantResult == PackageManager.PERMISSION_GRANTED) {
        grantedGroups.add(group)

      } else {
        rejectedGroups.add(group)
        canShowRationaleDialog = true
      }
    }

    if (canShowRationaleDialog) showRationaleDialog(this.askedPermGroup)

    else // TODO we are handling only one here
      grantedGroups.forEach { group ->
        cb(group, true)
      }
  }

  private fun showRationaleDialog(group: PermissionGroup?) {

    val builder     = AlertDialog.Builder(activity, R.style.PermissionDialog)
    val dialogView  = LayoutInflater.from(activity).inflate(R.layout.prm_rationale_dialog, null)
    builder.setView(dialogView)

    val dialog = builder.create()
    dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)

    val rationaleDesc : TextView = dialogView.find(R.id.prm_rtnl_desc)
    rationaleDesc.text = AndroidBase.fromHtml(this.rationaleText!!)

    val posBtn : Button = dialogView.find(R.id.prm_rtnl_pos_btn)
    val negBtn : Button = dialogView.find(R.id.prm_rtnl_neg_btn)

    posBtn.setOnClickListener {
      ActivityCompat.requestPermissions(activity, group!!.groupPermissions, group.reqCode)
      dialog.dismiss()
    }

    negBtn.setOnClickListener {
      activity.toast(R.string.prm_rationale_toast)
      cb(this.askedPermGroup!!, false)
      dialog.dismiss()
    }

    dialog.show()
    val width     = AndroidBase.calculate(90, AndroidBase.getScreenWidth(activity))
    val params    = dialog.window!!.attributes
    params.width  = width
    dialog.window!!.attributes = params
  }
}


