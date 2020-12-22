package ui.base

import android.app.Activity
import android.content.Intent
import android.graphics.Rect
import android.net.Uri
import android.view.View
import android.widget.FrameLayout
import androidx.annotation.NonNull
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.content.ContextCompat
import com.yalantis.ucrop.UCrop
import com.yalantis.ucrop.UCropActivity
import core.BaseApp
import core.MubbleLogger
import org.jetbrains.anko.find
import org.json.JSONArray
import org.json.JSONObject
import ui.auth.ContactsManager
import ui.auth.HintRequestManager
import ui.auth.LoginManager
import ui.biometric.MuBiometricPrompt
import ui.camera.PictureManager
import ui.document.DocumentManager
import ui.location.ULocationManager
import ui.permission.AskedPermission
import ui.permission.PermissionGroup
import ui.permission.PermissionManager
import ui.permission.PermissionRationales
import util.AndroidBase
import util.FileBase
import java.io.File
import kotlin.math.abs

open class ActivityUtilManagerBase(private val fileAuthority: String) : MubbleLogger {

  private var loginManager        : LoginManager?             = null
  private var permManager         : PermissionManager?        = null
  private var pictureManager      : PictureManager?           = null
  private var locationManager     : ULocationManager?         = null
  private var hintReqManager      : HintRequestManager?       = null
  private var documentManager     : DocumentManager?          = null
  private var biometricPrompt     : MuBiometricPrompt?        = null
  private var contactsManager     : ContactsManager?          = null

  protected var fetchingResource      : Boolean = false // Flag to check if app has requested work outside its context
  private lateinit var pictureCropCb  : (JSONObject) ->  Unit
  private var mobileBrowserOpened     : Boolean = false
  private var keyboardPan             : AndroidBug5497Workaround? = null

  open fun onActivityStart(activity: MubbleBaseWebActivity) {

    if (keyboardPan != null && keyboardPan!!.enabled) keyboardPan!!.enabled = true

    if (mobileBrowserOpened) {
      activity.onMobileBrowserClosed()
      mobileBrowserOpened = false
    }
  }

  open fun onActivityStop() {
    if (keyboardPan != null  && keyboardPan!!.enabled) keyboardPan!!.enabled = false
  }

  open fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?): Boolean {

    if (fetchingResource) fetchingResource = false

    if (loginManager != null && loginManager!!.isLoginRequestCode(requestCode)) {
      loginManager!!.onActivityResult(resultCode, data)
      return true
    }

    if (pictureManager != null && pictureManager!!.isPictureRequestCode(requestCode)) {
      pictureManager!!.onActivityResult(requestCode, resultCode, data)
      return true
    }

    if (locationManager != null && locationManager!!.isLocationRequestCode(requestCode)) {
      locationManager!!.onActivityResult(requestCode, resultCode, data)
      return true
    }

    if (hintReqManager != null && hintReqManager!!.isHintRequestCode(requestCode)) {
      hintReqManager!!.onActivityResult(requestCode, resultCode, data)
      return true
    }

    if (documentManager != null && documentManager!!.isRequestCode(requestCode)) {
      documentManager!!.onActivityResult(requestCode, resultCode, data)
      return true
    }

    if (requestCode == UCrop.REQUEST_CROP && resultCode == Activity.RESULT_OK) {
      val uri = UCrop.getOutput(data!!)!!
      onPictureCropped(uri)
      return true
    }

    return false
  }

  open fun isFetchingResource(): Boolean {
    return mobileBrowserOpened || fetchingResource
  }

  fun onRequestPermissionsResult(@NonNull permissions: Array<String>,
                                 @NonNull grantResults: IntArray) {

    if (fetchingResource) fetchingResource = false
    permManager?.onRequestPermissionsResult(permissions, grantResults)
  }

  fun cleanup() {

    locationManager?.stopLocationUpdates()

    locationManager     = null
    loginManager        = null
    permManager         = null
  }

  fun initKeyboardPanning(activity: MubbleBaseWebActivity, onPanChange:(Int) -> Unit) {
    keyboardPan = AndroidBug5497Workaround(activity, onPanChange)
  }

  fun initBiometricPrompt(activity: MubbleBaseWebActivity, texts : MuBiometricPrompt.Companion.FingerprintTexts) {

    val builder = MuBiometricPrompt.BiometricBuilder(activity)
        .setTitle(BaseApp.instance.getString(texts.title))
        .setSubtitle(String.format(BaseApp.instance.getString(texts.subTitle), BaseApp.instance.getString(texts.appName)))
        .setDescription(BaseApp.instance.getString(texts.description))
        .setNegativeButtonText(BaseApp.instance.getString(texts.negBtn))
        .build()

    biometricPrompt = MuBiometricPrompt(activity, builder)
  }

  fun canAuthWithFingerprint(): Boolean {
    return MuBiometricPrompt.canAuthenticate()
  }

  fun generateFpKeyPair(): String {
    return MuBiometricPrompt.generateKeyPair()
  }

  fun getContacts(activity: MubbleBaseWebActivity, cb: (JSONArray) -> Unit) {
    contactsManager = ContactsManager()
    contactsManager!!.getAllContacts(activity, true, cb)
  }

  fun fingerprintScan(activity: MubbleBaseWebActivity, challenge: String,
                      texts: MuBiometricPrompt.Companion.FingerprintTexts, cb: (JSONObject) -> Unit) {

    initBiometricPrompt(activity, texts)
    biometricPrompt!!.authenticate(challenge, cb)
  }

  fun login(activity: MubbleBaseWebActivity, partner: LoginManager.PARTNER, cb: (JSONObject) -> Unit) {

    loginManager = LoginManager(activity, partner) {

      responseCode: String, clientId: String?, idToken: String? ->

      val jsonObject = JSONObject()
      jsonObject.put("responseCode", responseCode)
      if (clientId !== null) jsonObject.put("clientId", clientId)
      if (idToken !== null) jsonObject.put("idToken", idToken)

      cb(jsonObject)
    }
  }

  fun getPermission(activity: MubbleBaseWebActivity, permission: String,
                    permissionRationales: PermissionRationales,
                    showRationale: Boolean, cb: (JSONObject) -> Unit) {

    val permGroup     : PermissionGroup = PermissionGroup.getGroup(permission)!!
    val rationaleText : String

    rationaleText = when (permGroup) {
      PermissionGroup.LOCATION  -> activity.getString(permissionRationales.locationTextResId)
      PermissionGroup.CAMERA    -> activity.getString(permissionRationales.cameraTextResId)
      PermissionGroup.STORAGE   -> activity.getString(permissionRationales.storageTextResId)
      PermissionGroup.CONTACTS  -> activity.getString(permissionRationales.contactsTextResId)
      PermissionGroup.SMS       -> activity.getString(permissionRationales.smsTextResId)
      PermissionGroup.BLUETOOTH -> activity.getString(permissionRationales.bluetoothTextResId)
    }

    val askedPerm = AskedPermission(permGroup, rationaleText)
    permManager = PermissionManager(activity, showRationale) {
      _, dialogShown, granted ->
      val jsonObject = JSONObject()
      jsonObject.put("permissionGiven", granted)
      jsonObject.put("dialogShown", dialogShown)
      cb(jsonObject)
    }

    permManager!!.askAppPermissions(mutableSetOf(askedPerm))
  }


  fun getCurrentLocation(activity: MubbleBaseWebActivity, cb: (JSONObject) -> Unit) {

    if (locationManager == null) locationManager = ULocationManager(activity)
    locationManager!!.getLocation(cb)
  }

  fun takePicture(activity: MubbleBaseWebActivity, aspectRatio : String, colorResId: Int, cb: (JSONObject) -> Unit) {

    pictureManager = PictureManager(activity, fileAuthority) {
      cropPicture(activity, it, aspectRatio, colorResId, cb)
    }
    pictureManager!!.openCamera()
    fetchingResource = true
  }

  fun selectPicture(activity: MubbleBaseWebActivity, colorResId: Int, cb: (JSONObject) -> Unit) {
    pictureManager = PictureManager(activity, fileAuthority) {
      cropPicture(activity, it, "1", colorResId, cb)
    }
    pictureManager!!.selectPicture()
    fetchingResource = true
  }

  fun requestMobNumHint(activity: MubbleBaseWebActivity, cb: (JSONObject) -> Unit) {

    if (hintReqManager == null) {
      hintReqManager = HintRequestManager(activity)
    }

    hintReqManager!!.requestMobNumHint {
      val resp = JSONObject()
      resp.put("selectedId", it)
      cb(resp)
    }
  }

  private fun cropPicture(activity: MubbleBaseWebActivity, result: JSONObject,
                          aspectRatio: String, colorResId: Int, cb: (JSONObject) -> Unit) {

    val picUri = result.optString("picUri")
    if (picUri.isNullOrBlank()) {
      cb(result)
      return
    }

    val uri = Uri.parse(picUri)
    pictureCropCb = cb

    val options = UCrop.Options()
    options.setCircleDimmedLayer(false)
    options.setHideBottomControls(true)
    options.setCompressionQuality(70)
    options.setCropFrameColor(ContextCompat.getColor(activity, colorResId))
    options.setToolbarColor(ContextCompat.getColor(activity, colorResId))
    options.setStatusBarColor(ContextCompat.getColor(activity, colorResId))
    options.setAllowedGestures(UCropActivity.SCALE, UCropActivity.NONE, UCropActivity.SCALE)

    val file = FileBase.convertContentUriToFile(uri, File(BaseApp.instance.filesDir, "users"), "temp.jpeg")

    var aspRatio = Pair(1f, 1f)
    if (aspectRatio != "1") {
      val asp  = aspectRatio.split("/")
      aspRatio = Pair(asp[0].toFloat(), asp[1].toFloat())
    }

    UCrop.of(Uri.fromFile(file), Uri.fromFile(file))
        .withAspectRatio(aspRatio.first, aspRatio.second)
        .withOptions(options)
        .start(activity)

    fetchingResource = true
  }

  private fun onPictureCropped(uri: Uri) {

    val base64   = FileBase.getBase64Data(uri)
    val checksum = FileBase.getCheckSum(base64)

    val jsonObject = JSONObject()
    jsonObject.put("success", true)
    jsonObject.put("base64", base64)
    jsonObject.put("mimeType", PictureManager.MIME_TYPE)
    jsonObject.put("cropped", true)
    jsonObject.put("checksum", checksum)

    pictureCropCb(jsonObject)
  }

  fun selectDocument(activity: MubbleBaseWebActivity, cb: (JSONObject) -> Unit) {
    documentManager = DocumentManager(activity, cb)
    documentManager!!.selectImgOrPdf()
    fetchingResource = true
  }

  fun requestToStartNavigation(activity:MubbleBaseWebActivity,lat:String,lng:String) {
    if(AndroidBase.isPackageInstalled(activity, "com.google.android.apps.maps")) {
      val uri = "http://maps.google.com/maps?daddr=$lat,$lng"
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri))
      intent.setPackage("com.google.android.apps.maps")
      activity.startActivity(intent)
    }
  }

  fun openInMobileBrowser(activity: MubbleBaseWebActivity, url: String) {

    val builder = CustomTabsIntent.Builder()
    val customTabsIntent = builder.build()

    val isChromeInstalled = AndroidBase.isPackageInstalled(activity, "com.android.chrome")

    if (isChromeInstalled) {
      customTabsIntent.intent.setPackage("com.android.chrome")
    }

    customTabsIntent.launchUrl(activity, Uri.parse(url))
    mobileBrowserOpened = true
  }

  fun closeMobileBrowser(activity: MubbleBaseWebActivity) {
    activity.bringToTop()
    mobileBrowserOpened = false
  }


  inner class AndroidBug5497Workaround(private val activity: MubbleBaseWebActivity,
                                       private val onPanChange:(Int) -> Unit) {

    private val mChildOfContent: View
    private var usableHeightPrevious: Int = 0
    var enabled: Boolean = true
    private var keyboardHeight: Int = 0

    init {

      val content : FrameLayout = activity.find(android.R.id.content)
      mChildOfContent = content.getChildAt(0)
      mChildOfContent.viewTreeObserver
          .addOnGlobalLayoutListener { possiblyResizeChildOfContent() }
    }

    private fun possiblyResizeChildOfContent() {

      if (!enabled) return

      val r = Rect()
      mChildOfContent.getWindowVisibleDisplayFrame(r)
      val usableHeightNow = r.bottom - r.top
      val navBarHeight = AndroidBase.getNavBarHeight(activity)

      if (usableHeightNow != usableHeightPrevious && abs(usableHeightNow - usableHeightPrevious) > navBarHeight) {

        val screenHeight = mChildOfContent.rootView.height
        val heightDifference = screenHeight - usableHeightNow - navBarHeight


        val factorHeight: Int
        if (heightDifference > 100) {
          keyboardHeight  = heightDifference / 2
          factorHeight    = -(AndroidBase.pxToDp(heightDifference.toFloat(), activity).toInt())
        } else {
          factorHeight    = 1
          keyboardHeight  = 0
        }

        onPanChange(factorHeight)
        usableHeightPrevious = usableHeightNow
      }
    }
  }


}