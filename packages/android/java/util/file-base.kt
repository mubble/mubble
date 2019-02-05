package util

import android.content.Context
import android.database.Cursor
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.util.Base64
import core.BaseApp
import java.io.*
import android.provider.OpenableColumns
import java.math.BigInteger
import java.security.MessageDigest
import java.security.NoSuchAlgorithmException

/**
 * Created by
 * siddharthgarg on 16/05/17.
 */

object FileBase {

  private val TAG = "FileBase"

  /**
   * The file copy buffer size (30 MB)
   */
  private val FILE_COPY_BUFFER_SIZE = (1024 * 1024 * 30).toLong()

  fun getLocalStoragePath(context: Context): String {

    return context.filesDir.absolutePath
  }

  fun getWebFileUrl(context: Context): String {
    return (getJsCodePath(context)
        + File.separator + ConstBase.InternalStorage.Code.WEB_FILE)
  }

  fun getJsCodePath(context: Context): String {

    return getLocalStoragePath(context) + File.separator +
        ConstBase.InternalStorage.Code.NAME
  }

  fun getJsUpgradePath(context: Context): String {

    return getLocalStoragePath(context) + File.separator +
        ConstBase.InternalStorage.Upgrade.NAME
  }

  fun asyncWriteFileToInternal(filePath: String,
                               fileName: String, bytes: ByteArray) {

    writeFileToInternal(BaseApp.instance, filePath, fileName, bytes)
  }

  fun writeFileToInternal(context: Context, filePath: String,
                          fileName: String, bytes: ByteArray): File {

    val output: File
    val dirs = filePath.split("/".toRegex()).dropLastWhile { it.isEmpty() }.toTypedArray()
    var path1 = ""
    for (dir in dirs) {
      path1 += File.separator + dir
    }

    path1 += File.separator

    val path = File(context.filesDir, path1)
    if (!path.exists()) path.mkdirs()
    output = File(path, fileName)
    if (!output.exists()) output.createNewFile()
    val stream = FileOutputStream(output)
    stream.write(bytes)
    stream.close()

    return output
  }

  fun readFileFromInternal(context: Context, filePath: String,
                           fileName: String): String? {

    val dirs = filePath.split("/".toRegex()).dropLastWhile { it.isEmpty() }.toTypedArray()
    var path1 = ""
    for (dir in dirs) {
      path1 += File.separator + dir
    }

    val path = File(getLocalStoragePath(context), path1)
    if (!path.exists()) return null

    val dirFiles = path.listFiles()
    var outFile: File? = null

    for (file in dirFiles) {
      if (file.name == fileName) {
        outFile = file
        break
      }
    }

    return if (outFile == null) null else readFile(outFile)
  }

  fun readFile(outFile: File?): String {

    val builder = StringBuilder("")
    val bufferedReader = BufferedReader(FileReader(outFile!!))
    var read: String? = bufferedReader.readLine()

    while (read != null) {
      builder.append(read)
      read = bufferedReader.readLine()
    }
    bufferedReader.close()
    return builder.toString()
  }

  fun writeFile(fullFilePath: String, fileName: String,
                bytes: ByteArray, append: Boolean): Boolean {

    try {
      val path = File(fullFilePath)
      if (!path.exists()) path.mkdirs()

      val output = File(path, fileName)
      if (!output.exists()) output.createNewFile()

      val stream = FileOutputStream(output, append)
      stream.write(bytes)
      stream.close()
      return true

    } catch (e: IOException) {
      error { "error: $e" }
    }
  }

  fun deleteRecursive(fileOrDirectory: File) {

    if (fileOrDirectory.isDirectory) {
      for (child in fileOrDirectory.listFiles()) {
        deleteRecursive(child)
      }
    }

    fileOrDirectory.delete()
  }

  fun convertContentUriToBase64(contentUri: Uri): String? {

    val inputStream = BaseApp.instance.contentResolver.openInputStream(contentUri)!!
    return convertStreamToBase64(inputStream)
  }

  fun convertFileToBase64(f: File): String? {

    val inputStream = FileInputStream(f)
    return convertStreamToBase64(inputStream)
  }

  fun convertStreamToBase64(inputStream: InputStream): String? {

    try {

      val bos = ByteArrayOutputStream()
      val b   = ByteArray(1024 * 11)

      var bytesRead = inputStream.read(b)
      while (bytesRead != -1) {
        bos.write(b, 0, bytesRead)
        bytesRead = inputStream.read(b)
      }

      val byteArray = bos.toByteArray()
      return Base64.encodeToString(byteArray, Base64.NO_WRAP)
    } catch (e: IOException) {
      e.printStackTrace()
    } catch (e: FileNotFoundException) {
      e.printStackTrace()
    }

    return null
  }

  fun getFileSize(contentUri: Uri): Long? {

    var cursor: Cursor? = null
    try {
      cursor = BaseApp.instance.contentResolver.query(contentUri, null, null, null, null)
      if (cursor != null && cursor.moveToFirst()) {
        val size: Long = cursor.getLong(cursor.getColumnIndex(OpenableColumns.SIZE))
        return size
      }
    } finally {
      cursor!!.close()
    }
    return null
  }

  fun getFileSize(file: File): Long? {
    return file.length()
  }

  fun calculateMD5(contentUri: Uri): String? {

    val inputStream = BaseApp.instance.contentResolver.openInputStream(contentUri)!!
    return calculateMD5(inputStream)
  }

  fun calculateMD5(fullFilePath: String, fileName: String): String? {

    val dirs = fullFilePath.split("/".toRegex()).dropLastWhile { it.isEmpty() }.toTypedArray()
    var path1 = ""
    for (dir in dirs) {
      path1 += File.separator + dir
    }

    val path = File(path1)
    if (!path.exists()) {
      error { "path doesn't exist to match md5" }
    }

    val dirFiles = path.listFiles()
    var updateFile: File? = null

    for (file in dirFiles) {
      if (file.name == fileName) {
        updateFile = file
        break
      }
    }

    if (updateFile == null) return null

    val inputStream: InputStream
    try {
      inputStream = FileInputStream(updateFile)

    } catch (e: FileNotFoundException) {
      error { "Exception while getting FileInputStream: $e" }
    }

    return calculateMD5(inputStream)
  }


  fun calculateMD5(file: File): String? {

    return calculateMD5(FileInputStream(file))
  }

  fun calculateMD5(inputStream: InputStream): String? {

    val digest: MessageDigest
    try {
      digest = MessageDigest.getInstance("MD5")

    } catch (e: NoSuchAlgorithmException) {
      error { "Exception while getting digest: $e" }
    }

    val buffer = ByteArray(8192)
    try {
      var read: Int = inputStream.read(buffer)
      while (read > 0) {
        digest.update(buffer, 0, read)
        read = inputStream.read(buffer)
      }

      val md5sum = digest.digest()
      val bigInt = BigInteger(1, md5sum)
      var output = bigInt.toString(16)
      // Fill to 32 chars
      output = String.format("%32s", output).replace(' ', '0')
      return output

    } catch (e: IOException) {
      throw RuntimeException("Unable to process file for MD5", e)

    } finally {
      try {
        inputStream.close()

      } catch (e: IOException) {
        error { "Exception on closing MD5 input stream: $e" }
      }
    }
  }

  fun getCheckSum(s: String): String {

    try {
      // Create MD5 Hash
      val digest = java.security.MessageDigest
          .getInstance("SHA-256")
      digest.update(s.toByteArray())
      val messageDigest = digest.digest()

      // Create Hex String
      val hexString = StringBuilder()
      for (aMessageDigest in messageDigest) {
        var h = Integer.toHexString(0xFF and aMessageDigest.toInt())
        while (h.length < 2)
          h = "0$h"
        hexString.append(h)
      }
      return hexString.toString()

    } catch (e: NoSuchAlgorithmException) {
      e.printStackTrace()
    }

    return ""
  }


  @Throws(IOException::class)
  fun getBitmapFromUri(uri: Uri?): Bitmap {

    val parcelFileDescriptor = BaseApp.instance.contentResolver.openFileDescriptor(uri!!, "r")
    val fileDescriptor = parcelFileDescriptor!!.fileDescriptor
    val image = BitmapFactory.decodeFileDescriptor(fileDescriptor)
    parcelFileDescriptor.close()
    return image
  }


  @Throws(FileNotFoundException::class)
  fun getBase64Data(uri: Uri?): String {

    val im = BaseApp.instance.contentResolver.openInputStream(uri!!)
    val bm = BitmapFactory.decodeStream(im)
    return getBase64Data(bm)
  }

  fun getBase64Data(bm: Bitmap): String {

    val baos = ByteArrayOutputStream()
    bm.compress(Bitmap.CompressFormat.JPEG, 70, baos)
    val b = baos.toByteArray()
    return Base64.encodeToString(b, Base64.NO_WRAP)
  }

}
