package `in`.mubble.android.ui.camera

import `in`.mubble.android.core.App
import `in`.mubble.android.ui.MubbleBaseActivity
import android.app.Activity.RESULT_OK
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.support.v4.content.FileProvider
import android.util.Base64
import org.json.JSONObject
import java.io.*

/**
 * Created by
 * siddharthgarg on 31/08/17.
 */

class PictureManager(private val parentActivity: MubbleBaseActivity,
                     private val listener: (JSONObject) -> Unit) {

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
      if (requestCode == REQUEST_CROP_PHOTO && galleryImgBase64 != null) {
        respondWithSuccess(galleryImgBase64, false)
        return
      }

      respondWithFailure(ERROR_ACT_RESULT_FAIL)
      return
    }

    try {
      val bm: Bitmap
      when (requestCode) {

        REQUEST_TAKE_PHOTO -> {
          bm = getBitmapFromUri(fileUri)
          galleryImgBase64 = getBase64Data(bm)
          cropCapturedImage(fileUri)
        }

        REQUEST_SELECT_PHOTO -> {
          if (data == null || data.data == null) {
            respondWithFailure(ERROR_INTENT_DATA_FAIL)
            return
          }

          val selectedImageUri = data.data
          bm = getBitmapFromUri(selectedImageUri)
          galleryImgBase64 = getBase64Data(bm)

          val baos = ByteArrayOutputStream()
          bm.compress(Bitmap.CompressFormat.JPEG, 70, baos)
          val b = baos.toByteArray()

          val storageDir = File(App.instance.filesDir, USERS)
          if (!storageDir.exists()) storageDir.mkdirs()

          output = File(storageDir, OUTPUT_FILENAME)
          val stream = FileOutputStream(output!!)
          stream.write(b)

          fileUri = FileProvider.getUriForFile(App.instance, AUTHORITY, output!!)
          cropCapturedImage(fileUri)
        }

        REQUEST_CROP_PHOTO -> {
          val encImage = getBase64Data(fileUri)
          respondWithSuccess(encImage, true)
        }
      }
    } catch (e: Exception) {
      respondWithFailure(ERROR_IO_EXCEPTION)
    }

  }

  fun takePicture() {

    val takePictureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)

    if (takePictureIntent.resolveActivity(App.instance.packageManager) != null) {

      output = File(File(App.instance.filesDir, USERS), OUTPUT_FILENAME)
      if (output!!.exists())
        output!!.delete()
      else
        output!!.parentFile.mkdirs()
      fileUri = FileProvider.getUriForFile(App.instance, AUTHORITY, output!!)

      takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, fileUri)
      takePictureIntent.putExtra("return-data", true)
      takePictureIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)

      this.currentReqCode = REQUEST_TAKE_PHOTO
      parentActivity.startActivityForResult(takePictureIntent, REQUEST_TAKE_PHOTO)

    } else {
      respondWithFailure(ERROR_ACT_NOT_FOUND)
    }
  }

  fun selectPicture() {

    val galleryIntent = Intent(Intent.ACTION_GET_CONTENT)

    if (galleryIntent.resolveActivity(App.instance.packageManager) != null) {
      galleryIntent.type = "image/*"
      galleryIntent.putExtra("return-data", true)

      this.currentReqCode = REQUEST_SELECT_PHOTO
      parentActivity.startActivityForResult(galleryIntent, REQUEST_SELECT_PHOTO)

    } else {
      val galleryPickIntent = Intent(Intent.ACTION_PICK,
      android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI)

      if (galleryPickIntent.resolveActivity(App.instance.packageManager) != null) {
        galleryPickIntent.type = "image/*"
        galleryPickIntent.putExtra("return-data", true)

        this.currentReqCode = REQUEST_SELECT_PHOTO
        parentActivity.startActivityForResult(galleryPickIntent, REQUEST_SELECT_PHOTO)

      } else {
        respondWithFailure(ERROR_ACT_NOT_FOUND)
      }
    }
  }

  private fun cropCapturedImage(picUri: Uri?) {

    val cropIntent = Intent("com.android.camera.action.CROP")
    cropIntent.setDataAndType(picUri, MIME_TYPE)

    val list = App.instance.packageManager.queryIntentActivities(cropIntent, 0)
    val size = list.size

    if (size == 0) { // Cropping not supported on device
      respondWithSuccess(galleryImgBase64, false)
      return
    }

    val bundle = pictureCropExtras
    cropIntent.putExtras(bundle)
    cropIntent.putExtra(MediaStore.EXTRA_OUTPUT, picUri)
    cropIntent.flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
    cropIntent.putExtra("outputFormat", Bitmap.CompressFormat.JPEG.toString())

    this.currentReqCode = REQUEST_CROP_PHOTO
    parentActivity.startActivityForResult(cropIntent, REQUEST_CROP_PHOTO)
  }

  @Throws(IOException::class)
  private fun getBitmapFromUri(uri: Uri?): Bitmap {

    val parcelFileDescriptor = App.instance.contentResolver.openFileDescriptor(uri!!, "r")
    val fileDescriptor = parcelFileDescriptor!!.fileDescriptor
    val image = BitmapFactory.decodeFileDescriptor(fileDescriptor)
    parcelFileDescriptor.close()
    return image
  }

  private fun respondWithFailure(failureCode: String) {

    onPictureResult(false, null, null, null, failureCode)
  }

  private fun respondWithSuccess(base64: String?, cropped: Boolean) {

    onPictureResult(false, base64, MIME_TYPE, cropped, null)
  }

  private fun onPictureResult(success: Boolean, base64: String?, mimeType: String?,
                               cropped: Boolean?, failureCode: String?) {

    val jsonObject = JSONObject()
    jsonObject.put("success", true)
    jsonObject.put("base64", base64)
    jsonObject.put("mimeType", mimeType)
    jsonObject.put("cropped", cropped)

    listener(jsonObject)
    cleanUp()
  }

  @Throws(FileNotFoundException::class)
  private fun getBase64Data(uri: Uri?): String {

    val im = App.instance.contentResolver.openInputStream(uri!!)
    val bm = BitmapFactory.decodeStream(im)
    return getBase64Data(bm)
  }

  private fun getBase64Data(bm: Bitmap): String {

    val baos = ByteArrayOutputStream()
    bm.compress(Bitmap.CompressFormat.JPEG, 70, baos)
    val b = baos.toByteArray()
    return Base64.encodeToString(b, Base64.DEFAULT)
  }

  private fun cleanUp() {

    if (output != null && output!!.exists()) output!!.delete()
    galleryImgBase64 = null
  }

  companion object {

    val REQUEST_TAKE_PHOTO              = 2001
    val REQUEST_CROP_PHOTO              = 2002
    val REQUEST_SELECT_PHOTO            = 2003

    private val AUTHORITY               = "in.mubble.newschat.fileprovider"
    private val USERS                   = "users"
    private val OUTPUT_FILENAME         = "output.jpeg"
    private val MIME_TYPE               = "image/jpeg"

    private val ERROR_ACT_NOT_FOUND     = "actNotFound"
    private val ERROR_ACT_RESULT_FAIL   = "actResultFailure"
    private val ERROR_INTENT_DATA_FAIL  = "intentDataFailure"
    private val ERROR_IO_EXCEPTION      = "ioException"
  }
}