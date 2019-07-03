package ui.camera

import android.app.Activity.RESULT_OK
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import androidx.core.content.FileProvider
import core.BaseApp
import core.ImageCompressionTask
import core.MubbleLogger
import org.json.JSONObject
import ui.base.MubbleBaseActivity
import util.FileBase
import java.io.*

/**
 * Created by
 * siddharthgarg on 31/08/17.
 */

class PictureManager(private val parentActivity : MubbleBaseActivity,
                     private val listener       : (JSONObject) -> Unit,
                     private val fileAuthority  : String) : MubbleLogger {

  private var fileUri           : Uri?    = null
  private var galleryImgBase64  : String? = null
  private var output            : File?   = null
  private var currentReqCode    : Int?    = -1

  private val pictureCropExtras : Bundle
    get() {

      val bundle = Bundle()
      bundle.putString("crop", "true")
      bundle.putInt("aspectX", 1)
      bundle.putInt("aspectY", 1)
      bundle.putInt("outputX", 256)
      bundle.putInt("outputY", 256)
      bundle.putBoolean("return-data", true)
      return bundle
    }

  fun isPictureRequestCode(requestCode: Int) : Boolean = requestCode == currentReqCode

  fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {

    if (resultCode != RESULT_OK) {
      respondWithFailure(ERROR_ACT_RESULT_FAIL)
      return
    }

    try {

      val bm: Bitmap
      when (requestCode) {

        REQUEST_TAKE_PHOTO -> {
          // TODO: compress fileUri
          bm = FileBase.getBitmapFromUri(fileUri)
          galleryImgBase64 = FileBase.getBase64Data(bm)
          cropCapturedImage(fileUri)
        }

        REQUEST_SELECT_PHOTO -> {
          if (data == null || data.data == null) {
            respondWithFailure(ERROR_INTENT_DATA_FAIL)
            return
          }

          bm                = FileBase.getBitmapFromUri(data.data)
          galleryImgBase64  = FileBase.getBase64Data(bm)

          val byteArr       = FileBase.getByteArray(bm)

          val storageDir    = File(BaseApp.instance.filesDir, USERS)
          if (!storageDir.exists()) storageDir.mkdirs()

          output            = File(storageDir, OUTPUT_FILENAME)
          val stream        = FileOutputStream(output!!)
          stream.write(byteArr)

          fileUri           = FileProvider.getUriForFile(BaseApp.instance, fileAuthority, output!!)

          cropCapturedImage(fileUri)
        }

        REQUEST_CROP_PHOTO -> {
          val encImage = FileBase.getBase64Data(fileUri)
          respondWithSuccess(encImage, true)
        }
      }

    } catch (e: Exception) {
      respondWithFailure(ERROR_IO_EXCEPTION)
    }

  }

  fun takePicture() {

    val takePictureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)

    val resolvedIntentActivities = BaseApp.instance.packageManager
        .queryIntentActivities(takePictureIntent, PackageManager.MATCH_DEFAULT_ONLY)

    if (resolvedIntentActivities.isEmpty()) {
      respondWithFailure(ERROR_ACT_NOT_FOUND)
      return
    }

    output = File(File(BaseApp.instance.filesDir, USERS), OUTPUT_FILENAME)
    if (output!!.exists()) output!!.delete()
    else output!!.parentFile.mkdirs()

    fileUri = FileProvider.getUriForFile(BaseApp.instance, fileAuthority, output!!)

    takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, fileUri)
    takePictureIntent.putExtra("return-data", true)

    this.currentReqCode = REQUEST_TAKE_PHOTO

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

  private fun cropCapturedImage(picUri: Uri?) {

    val cropIntent = Intent("com.android.camera.action.CROP")
    cropIntent.setDataAndType(picUri, MIME_TYPE)

    val list = BaseApp.instance.packageManager.queryIntentActivities(cropIntent,
        PackageManager.MATCH_DEFAULT_ONLY)
    val size = list.size

    if (size == 0) {
      respondWithSuccess(galleryImgBase64, false) // Cropping not supported on device
      return
    }

    list.forEach {
      BaseApp.instance.grantUriPermission(it.activityInfo.packageName, fileUri,
          Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }

    val bundle = pictureCropExtras

    cropIntent.setDataAndType(picUri, "image/*")
    cropIntent.putExtras(bundle)
    cropIntent.putExtra(MediaStore.EXTRA_OUTPUT, picUri)
    cropIntent.putExtra("outputFormat", Bitmap.CompressFormat.JPEG.toString())

    this.currentReqCode = REQUEST_CROP_PHOTO
    if (size == 1) {
      parentActivity.startActivityForResult(cropIntent, REQUEST_CROP_PHOTO)
    } else {
      parentActivity.startActivityForResult(Intent
          .createChooser(cropIntent, "Crop Using"), REQUEST_CROP_PHOTO)
    }
  }

  private fun respondWithFailure(failureCode: String) {

    onPictureResult(false, null, null, null,null, failureCode)
  }

  private fun respondWithSuccess(base64: String?, cropped: Boolean) {

    val b64       = if (base64 != null) ImageCompressionTask().compressImage(base64) else base64
    val checkSum  = if (b64 != null) FileBase.getCheckSum(b64) else null
    onPictureResult(true, b64, MIME_TYPE, cropped, checkSum, null)
  }

  private fun onPictureResult(success: Boolean, base64: String?, mimeType: String?,
                               cropped: Boolean?, checkSum: String?, failureCode: String?) {

    val jsonObject = JSONObject()
    jsonObject.put("success", success)
    jsonObject.put("base64", base64)
    jsonObject.put("mimeType", mimeType)
    jsonObject.put("cropped", cropped)
    jsonObject.put("checksum", checkSum)
    jsonObject.put("failureCode", failureCode)

    listener(jsonObject)
    cleanUp()
  }

  private fun cleanUp() {

    if (output != null && output!!.exists()) output!!.delete()
    galleryImgBase64 = null
  }

  companion object {

    const val REQUEST_TAKE_PHOTO              = 2001
    const val REQUEST_CROP_PHOTO              = 2002
    const val REQUEST_SELECT_PHOTO            = 2003

    private const val USERS                   = "users"
    private const val OUTPUT_FILENAME         = "output.jpeg"
    private const val MIME_TYPE               = "image/jpeg"

    private const val ERROR_ACT_NOT_FOUND     = "actNotFound"
    private const val ERROR_ACT_RESULT_FAIL   = "actResultFailure"
    private const val ERROR_INTENT_DATA_FAIL  = "intentDataFailure"
    private const val ERROR_IO_EXCEPTION      = "ioException"
  }
}