package util

import java.io.ByteArrayOutputStream
import java.util.zip.Deflater
import java.util.zip.Inflater

/**
 * Created by
 * siddharthgarg on 10/04/18.
 */

object CryptoBase {

  fun inflate(bytes: ByteArray): ByteArray {

    val inflater = Inflater()
    inflater.setInput(bytes)

    val outputStream  = ByteArrayOutputStream(bytes.size)
    val buffer        = ByteArray(1024)

    while (!inflater.finished()) {
      val count = inflater.inflate(buffer)
      outputStream.write(buffer, 0, count)
    }

    outputStream.close()

    return outputStream.toByteArray()
  }

  fun deflate(bytes: ByteArray): ByteArray {

    val deflater = Deflater()
    deflater.setInput(bytes)

    val outputStream  = ByteArrayOutputStream(bytes.size)
    deflater.finish()

    val buffer        = ByteArray(1024)
    while (!deflater.finished()) {
      val count = deflater.deflate(buffer)
      outputStream.write(buffer, 0, count)
    }

    outputStream.close()

    return outputStream.toByteArray()
  }
}
