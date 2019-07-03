package ui.biometric

import com.google.android.material.bottomsheet.BottomSheetDialog
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import core.BaseApp

data class DialogViewRes(val v23BotSheetThemeId  : Int) {

  var botSheetViewId      : Int? = null
  var btnCancelId         : Int? = null
  var imgLogoId           : Int? = null
  var itemTitleId         : Int? = null
  var itemStatusId        : Int? = null
  var itemSubtitleId      : Int? = null
  var itemDescId          : Int? = null
}

class BiometricDialogV23(private val biometricCallback: BiometricCallback, private val dialogViewRes: DialogViewRes) :
    BottomSheetDialog(BaseApp.instance, dialogViewRes.v23BotSheetThemeId), View.OnClickListener {

  private lateinit var btnCancel       : Button
  private lateinit var imgLogo         : ImageView
  private lateinit var itemTitle       : TextView
  private lateinit var itemDescription : TextView
  private lateinit var itemSubtitle    : TextView
  private lateinit var itemStatus      : TextView

  init {
    setDialogView()
  }

  override fun onClick(v: View?) {

    dismiss()
    biometricCallback.onAuthenticationCancelled()
  }

  private fun setDialogView() {


    val bottomSheetView = layoutInflater.inflate(dialogViewRes.botSheetViewId!!, null)
    setContentView(bottomSheetView)

    btnCancel = findViewById(dialogViewRes.btnCancelId!!)!!
    btnCancel.setOnClickListener(this)

    imgLogo         = findViewById(dialogViewRes.imgLogoId!!)!!
    itemTitle       = findViewById(dialogViewRes.itemTitleId!!)!!
    itemStatus      = findViewById(dialogViewRes.itemStatusId!!)!!
    itemSubtitle    = findViewById(dialogViewRes.itemSubtitleId!!)!!
    itemDescription = findViewById(dialogViewRes.itemDescId!!)!!

    updateLogo()
  }

  fun setTitle(title: String) {
    itemTitle.text = title
  }

  fun updateStatus(status: String) {
    itemStatus.text = status
  }

  fun setSubtitle(subtitle: String) {
    itemSubtitle.text = subtitle
  }

  fun setDescription(description: String) {
    itemDescription.text = description
  }

  fun setButtonText(negativeButtonText: String) {
    btnCancel.text = negativeButtonText
  }

  private fun updateLogo() {
    try {
      val drawable = context.packageManager.getApplicationIcon(context.packageName)
      imgLogo.setImageDrawable(drawable)

    } catch (e: Exception) {
      e.printStackTrace()
    }

  }


}
