package ui.biometric

import android.support.design.widget.BottomSheetDialog
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import core.BaseApp
import com.obopay.mobilemoney.R

class BiometricDialogV23(private val biometricCallback: BiometricCallback) :
    BottomSheetDialog(BaseApp.instance, R.style.BottomSheetDialogTheme), View.OnClickListener {

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

    val bottomSheetView = layoutInflater.inflate(R.layout.view_bottom_sheet, null)
    setContentView(bottomSheetView)

    btnCancel = findViewById(R.id.btn_cancel)!!
    btnCancel.setOnClickListener(this)

    imgLogo         = findViewById(R.id.img_logo)!!
    itemTitle       = findViewById(R.id.item_title)!!
    itemStatus      = findViewById(R.id.item_status)!!
    itemSubtitle    = findViewById(R.id.item_subtitle)!!
    itemDescription = findViewById(R.id.item_description)!!

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
