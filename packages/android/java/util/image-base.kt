package util

import android.graphics.Bitmap
import android.graphics.Matrix
import android.media.ExifInterface
import java.io.IOException
import android.R.attr.path



object ImageBase {

  @Throws(IOException::class)
  fun modifyOrientation(bitmap: Bitmap, imgAbsolutePath: String): Bitmap {

    val ei          = ExifInterface(imgAbsolutePath)
    val orientation = ei.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)

    return when (orientation) {
      ExifInterface.ORIENTATION_ROTATE_90 -> rotate(bitmap, 90f)

      ExifInterface.ORIENTATION_ROTATE_180 -> rotate(bitmap, 180f)

      ExifInterface.ORIENTATION_ROTATE_270 -> rotate(bitmap, 270f)

      ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> flip(bitmap, true, false)

      ExifInterface.ORIENTATION_FLIP_VERTICAL -> flip(bitmap, false, true)

      else -> bitmap
    }
  }

  fun rotate(bitmap: Bitmap, degrees: Float): Bitmap {
    val matrix = Matrix()
    matrix.postRotate(degrees)
    return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
  }

  fun flip(bitmap: Bitmap, horizontal: Boolean, vertical: Boolean): Bitmap {
    val matrix = Matrix()
    matrix.preScale(if (horizontal) -1F else 1F, if (vertical) -1F else 1F)
    return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
  }

  fun getExlifOrientation(path: String): Int {

    var exif: ExifInterface? = null
    try {
      exif = ExifInterface(path)
    } catch (e: IOException) {
      e.printStackTrace()
    }

    return exif!!.getAttributeInt(ExifInterface.TAG_ORIENTATION,
        ExifInterface.ORIENTATION_UNDEFINED)
  }

  fun rotateBitmap(bitmap: Bitmap, orientation: Int): Bitmap? {

    val matrix = Matrix()
    when (orientation) {
      ExifInterface.ORIENTATION_NORMAL -> return bitmap
      ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.setScale(-1f, 1f)
      ExifInterface.ORIENTATION_ROTATE_180 -> matrix.setRotate(180f)
      ExifInterface.ORIENTATION_FLIP_VERTICAL -> {
        matrix.setRotate(180f)
        matrix.postScale(-1f, 1f)
      }
      ExifInterface.ORIENTATION_TRANSPOSE -> {
        matrix.setRotate(90f)
        matrix.postScale(-1f, 1f)
      }
      ExifInterface.ORIENTATION_ROTATE_90 -> matrix.setRotate(90f)
      ExifInterface.ORIENTATION_TRANSVERSE -> {
        matrix.setRotate(-90f)
        matrix.postScale(-1f, 1f)
      }
      ExifInterface.ORIENTATION_ROTATE_270 -> matrix.setRotate(-90f)
      else -> return bitmap
    }
    try {
      val bmRotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
      bitmap.recycle()
      return bmRotated
    } catch (e: OutOfMemoryError) {
      e.printStackTrace()
      return null
    }

  }

  fun compressImage(imageUri: String) {


  }

}