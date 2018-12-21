package util

import android.content.Context
import core.BaseApp
import org.jetbrains.anko.error
import java.io.*

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
}
