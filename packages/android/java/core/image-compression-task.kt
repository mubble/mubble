package core

import android.graphics.*
import android.util.Base64
import com.obopay.mobilemoney.core.App
import util.FileBase
import java.lang.Exception

class ImageCompressionTask: MubbleLogger {

  fun compressImage(base64Data: String): String? {

    val filePath = FileBase.getUsersPath(App.instance)
    val fileName = "temp.jpeg"

    val file    = FileBase.writeFileToInternal(App.instance, filePath, fileName, Base64.decode(base64Data, Base64.NO_WRAP))
    val imgUri  = file.absolutePath

    try {

      var scaledBitmap  : Bitmap
      val options                 = BitmapFactory.Options()
      options.inJustDecodeBounds  = true
      var bmp                     = BitmapFactory.decodeFile(imgUri, options)

      var actualHeight = options.outHeight
      var actualWidth  = options.outWidth

      val maxHeight    = 800.0f
      val maxWidth     = 800.0f

      var imgRatio     = actualWidth * 1f / actualHeight
      val maxRatio     = maxWidth * 1f / maxHeight

      if (actualHeight > maxHeight || actualWidth > maxWidth) {
        when {
          imgRatio < maxRatio -> {
            imgRatio      = maxHeight / actualHeight
            actualWidth   = (imgRatio * actualWidth).toInt()
            actualHeight  = maxHeight.toInt()

          }
          imgRatio > maxRatio -> {
            imgRatio      = maxWidth / actualWidth
            actualHeight  = (imgRatio * actualHeight).toInt()
            actualWidth   = maxWidth.toInt()
          }
          else -> {
            actualHeight  = maxHeight.toInt()
            actualWidth   = maxWidth.toInt()
          }
        }
      }

      options.inSampleSize        = calculateInSampleSize(options, actualWidth, actualHeight)
      options.inJustDecodeBounds  = false
      options.inDither            = false
      options.inPurgeable         = true
      options.inInputShareable    = true
      options.inTempStorage       = ByteArray(16*1024)

      try {
        bmp = BitmapFactory.decodeFile(imgUri, options)
      } catch (e: OutOfMemoryError) {
        e.printStackTrace()
      } finally {
        file.delete()
      }

      scaledBitmap = Bitmap.createBitmap(actualWidth, actualHeight, Bitmap.Config.ARGB_8888)

      val ratioX  = actualWidth * 1f / options.outWidth
      val ratioY  = actualHeight * 1f / options.outHeight
      val middleX = actualWidth / 2.0f
      val middleY = actualHeight / 2.0f

      val scaleMatrix = Matrix()
      scaleMatrix.setScale(ratioX, ratioY, middleX, middleY)

      val canvas = Canvas(scaledBitmap)
      canvas.matrix = scaleMatrix
      canvas.drawBitmap(bmp, middleX - bmp.width/2, middleY - bmp.height/2, Paint(Paint.FILTER_BITMAP_FLAG))

      //val exif        = ExifInterface(imgUri)
      //val orientation = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, 0)
      val matrix      = Matrix()

//      when (orientation) {
//        0 -> matrix.postRotate(90f)
//        3 -> matrix.postRotate(180f)
//        8 -> matrix.postRotate(270f)
//      }

      scaledBitmap = Bitmap.createBitmap(scaledBitmap, 0, 0,scaledBitmap.width, scaledBitmap.height, matrix, true)

      return FileBase.getBase64Data(scaledBitmap)

    } catch (e: Exception) {
      e.printStackTrace()
    } finally {
      file.delete()
    }

    return null
  }

  private fun calculateInSampleSize(options: BitmapFactory.Options, reqWidth: Int, reqHeight: Int): Int {

    val height = options.outHeight
    val width  = options.outWidth
    var inSampleSize = 1

    if (height > reqHeight || width > reqWidth) {
      val heightRatio = Math.round(height*1f / reqHeight)
      val widthRatio  = Math.round(width*1f / reqWidth)
      inSampleSize    = if (heightRatio < widthRatio) heightRatio else widthRatio
    }

    val totalPixels       = width * height
    val totalReqPixelsCap = reqWidth * reqHeight * 2

    while (totalPixels / (inSampleSize * inSampleSize) > totalReqPixelsCap) {
      inSampleSize++
    }
    return inSampleSize
  }
}