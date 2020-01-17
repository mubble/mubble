package ui.camera

import android.app.Activity.RESULT_OK
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.MediaStore
import androidx.core.content.FileProvider
import core.BaseApp
import core.ImageCompressionTask
import core.MubbleLogger
import org.json.JSONObject
import ui.base.MubbleBaseActivity
import util.FileBase
import java.io.File
import java.io.FileOutputStream

/**
 * Created by
 * siddharthgarg on 31/08/17.
 */

class PictureManager(private val parentActivity : MubbleBaseActivity,
                     private val fileAuthority  : String,
                     private val listener       : (JSONObject) -> Unit) : MubbleLogger {

  private var fileUri           : Uri?    = null
  private var output            : File?   = null
  private var currentReqCode    : Int?    = -1

  fun isPictureRequestCode(requestCode: Int) : Boolean = requestCode == currentReqCode

  fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {

    if (resultCode != RESULT_OK) {
      respondWithFailure(ERROR_ACT_RESULT_FAIL)
      return
    }

    try {

      when (requestCode) {

        REQUEST_TAKE_PHOTO -> {
          val uri = fileUri
          respondWithSuccess(uri, null, false)
        }

        REQUEST_SELECT_PHOTO -> {
          if (data == null || data.data == null) {
            respondWithFailure(ERROR_INTENT_DATA_FAIL)
            return
          }

          val bm            = FileBase.getBitmapFromUri(data.data)
          val byteArr       = FileBase.getByteArray(bm)

          val storageDir    = File(BaseApp.instance.filesDir, USERS)
          if (!storageDir.exists()) storageDir.mkdirs()

          output            = File(storageDir, OUTPUT_FILENAME)
          val stream        = FileOutputStream(output!!)
          stream.write(byteArr)

          fileUri           = FileProvider.getUriForFile(BaseApp.instance, fileAuthority, output!!)

          respondWithSuccess(fileUri, null, false)
        }
      }

    } catch (e: Exception) {
      respondWithFailure(ERROR_IO_EXCEPTION)
    }
  }

  fun openCamera() {

    val takePictureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)

    val resolvedIntentActivities = BaseApp.instance.packageManager
        .queryIntentActivities(takePictureIntent, PackageManager.MATCH_DEFAULT_ONLY)

    if (resolvedIntentActivities.isEmpty()) {
      respondWithFailure(ERROR_ACT_NOT_FOUND)
      return
    }

    output = File(File(BaseApp.instance.filesDir, USERS), OUTPUT_FILENAME)
    if (output!!.exists()) output!!.delete()
    else output!!.parentFile!!.mkdirs()

    fileUri = FileProvider.getUriForFile(BaseApp.instance, fileAuthority, output!!)

    takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, fileUri)
    takePictureIntent.putExtra("return-data", true)

    currentReqCode = REQUEST_TAKE_PHOTO

    resolvedIntentActivities.forEach {
      BaseApp.instance.grantUriPermission(it.activityInfo.packageName, fileUri,
          Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }

    if (resolvedIntentActivities.size == 1) {
      parentActivity.startActivityForResult(takePictureIntent, REQUEST_TAKE_PHOTO)
    } else {
      parentActivity.startActivityForResult(Intent
          .createChooser(takePictureIntent, "Take Picture"), REQUEST_TAKE_PHOTO)
    }
  }

  fun selectPicture() {

    val galleryIntent = Intent(Intent.ACTION_GET_CONTENT)

    val resolvedIntentActivities = BaseApp.instance.packageManager
        .queryIntentActivities(galleryIntent, PackageManager.MATCH_DEFAULT_ONLY)

    if (resolvedIntentActivities.isEmpty()) {
      pickFromGallery() // Fallback to ACTION_PICK
    } else {
      openGalleryForIntent(galleryIntent, resolvedIntentActivities.size)
    }
  }

  private fun pickFromGallery() {

    val galleryPickIntent = Intent(Intent.ACTION_PICK,
        android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI)

    val resolvedIntentActivities = BaseApp.instance.packageManager
        .queryIntentActivities(galleryPickIntent, PackageManager.MATCH_DEFAULT_ONLY)

    if (resolvedIntentActivities.isEmpty()) {
      respondWithFailure(ERROR_ACT_NOT_FOUND)
    } else {
      openGalleryForIntent(galleryPickIntent, resolvedIntentActivities.size)
    }
  }

  private fun openGalleryForIntent(galleryIntent: Intent, resolvedActivitySize: Int) {

    galleryIntent.type = "image/*"
    galleryIntent.putExtra("return-data", true)

    this.currentReqCode = REQUEST_SELECT_PHOTO

    if (resolvedActivitySize == 1) {
      parentActivity.startActivityForResult(galleryIntent, REQUEST_SELECT_PHOTO)
    } else {
      parentActivity.startActivityForResult(Intent
          .createChooser(galleryIntent, "Select Picture"), REQUEST_SELECT_PHOTO)
    }
  }

  private fun respondWithFailure(failureCode: String) {

    onPictureResult(false, null,null, null, null,null, failureCode)
  }

  private fun respondWithSuccess(picUri: Uri?, base64: String?, cropped: Boolean) {

    val b64       = if (base64 != null) ImageCompressionTask().compressImage(base64) else base64
    val checkSum  = if (b64 != null) FileBase.getCheckSum(b64) else null
    onPictureResult(true, picUri, b64, MIME_TYPE, cropped, checkSum, null)
  }

  private fun onPictureResult(success: Boolean, picUri: Uri?, base64: String?, mimeType: String?,
                               cropped: Boolean?, checkSum: String?, failureCode: String?) {

    val jsonObject = JSONObject()
    jsonObject.put("success", success)
    jsonObject.put("base64", base64)
    jsonObject.put("mimeType", mimeType)
    jsonObject.put("cropped", cropped)
    jsonObject.put("checksum", checkSum)
    jsonObject.put("failureCode", failureCode)

    jsonObject.put("picUri", picUri)

    listener(jsonObject)
    cleanUp()
  }

  private fun cleanUp() {

    if (output != null && output!!.exists()) output!!.delete()
  }

  companion object {

    const val REQUEST_TAKE_PHOTO              = 2001
    const val REQUEST_SELECT_PHOTO            = 2002

    private const val USERS                   = "users"
    private const val OUTPUT_FILENAME         = "output.jpeg"
            const val MIME_TYPE               = "image/jpeg"

    private const val ERROR_ACT_NOT_FOUND     = "actNotFound"
    private const val ERROR_ACT_RESULT_FAIL   = "actResultFailure"
    private const val ERROR_INTENT_DATA_FAIL  = "intentDataFailure"
    private const val ERROR_IO_EXCEPTION      = "ioException"
  }
}