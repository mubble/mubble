package xmn

import android.util.Base64
import core.MubbleLogger
import org.jetbrains.anko.info
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import util.CryptoBase
import java.nio.charset.Charset
import java.security.KeyFactory
import java.security.SecureRandom
import java.security.spec.X509EncodedKeySpec
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

/*------------------------------------------------------------------------------
   About      : Router to manage communication with mubble servers

   Created on : 17/01/18
   Author     : Raghvendra Varma

   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.

--------------------------------------------------------------------------------

------------------------------------------------------------------------------*/

class EncProviderAndroid(ci                     : ConnectionInfo,
                         private val rsaPubKey  : ByteArray?) : MubbleLogger {

  private var syncKey    : ByteArray = ByteArray(32)

  companion object {
    // not making these thread safe as these are used once at app load time
    private var initialized = false
    private val arShortCode : ByteArray = ByteArray(4)
    private val arUniqueId  : ByteArray = ByteArray(3)

    fun init(ci : ConnectionInfo) {

      if (initialized) return

      initialized = true

      val regex = Regex("[a-zA-Z0-9]{1,4}")
      var index = 0

      // Populate the application's short code
      check(ci.shortName.matches(regex))
      for (char in ci.shortName) {
        arShortCode[index++] = char.toByte().minus(40).toByte()
      }

      // Populate the unique id (version number)
      index = 0
      var parts: List<Int> = ci.customData!!.appVersion!!.split('.').map {it.toInt()}

      if (parts.size > 1) {
        check(parts.size == 3 && parts[0] <= 99 && parts[1] <= 99 && parts[2] <= 99)
      } else {
        val num = parts[0]
        parts   = listOf(num / 10000, num % 10000 / 100 , num % 100)
      }

      for (part in parts) arUniqueId[index++] = part.toByte()
    }

    fun byteArrayToBase64(byteArr: ByteArray): String = Base64.encodeToString(byteArr, Base64.NO_WRAP)

    fun base64ToByteArray(str: String): ByteArray = Base64.decode(str, Base64.NO_WRAP)
  }

  private val ivSpec = IvParameterSpec(byteArrayOf(0x01, 0x00, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00,
                                                   0x01, 0x00, 0x09, 0x00, 0x07, 0x00, 0x00, 0x00))

  init {
    //init(ci)
    SecureRandom().nextBytes(this.syncKey)
  }

  fun getSyncKeyB64(): String {
    return byteArrayToBase64(this.syncKey)
  }

  fun encodeHeader(wsConfig: WsProviderConfig): String {

    val now           = System.currentTimeMillis() * 1000 // microseconds
    val tsBuffer      = this.encryptDecrypt(this.strToByteArray(now.toString()))
    val tsB64         = byteArrayToBase64(tsBuffer)

    val keyBuffer     = this.encryptKey()
    val keyB64        = byteArrayToBase64(keyBuffer)

    val configBuffer  = this.encryptDecrypt(this.strToByteArray(wsConfig.toJsonObject().toString()))
    val configB64     = byteArrayToBase64(configBuffer)

    return "$tsB64$keyB64$configB64"
  }

  fun encodeBody(data: Array<WireObject>): ByteArray {

    val str = stringifyWireObjects(data)

    var firstPassArray  : ByteArray?  = null
    var deflate                       = false

    if (str.length > Encoder.MIN_SIZE_TO_COMPRESS) {

      val byteArr = strToByteArray(str)
      val ar      = CryptoBase.deflate(byteArr)

      if (ar.size < byteArr.size) {
        firstPassArray  = ar
        deflate         = true
      }
    }

    if (firstPassArray == null) {
      firstPassArray  = strToByteArray(str)
    }

    val secondPassArray = this.encryptDecrypt(firstPassArray)
    val arOut           = ByteArray(secondPassArray.size + 1)
    val leader          = if (deflate) DataLeader.ENC_DEF_JSON else DataLeader.ENC_JSON

    arOut[0] = leader.toByte()

    for (i in 0 until secondPassArray.size) arOut[i+1] = secondPassArray[i]

    info { "encodeBody,\n" +
           "first       : ${data[0].name}, \n" +
           "messages    : ${data.size}, \n" +
           "json        : ${str.length}, \n" +
           "wire        : ${arOut.size}, \n" +
           "encrypted   : true, \n" +
           "compressed  : $deflate" }

    return arOut
  }

  fun decodeBody(bytes: ByteArray): MutableList<WireObject> {

    val inAr: ByteArray = bytes.sliceArray(IntRange(1, bytes.size-1))    //.slice(1 until bytes.size)
    val leader          = bytes[0]
    val temp            = this.encryptDecrypt(inAr, true)

    val arData: MutableList<WireObject> = mutableListOf()
    val decLen: Int
    val deflated: Boolean

    var index = 0

    if (leader == DataLeader.BINARY.toByte()) {

      val newLineCode = "\n".toByteArray(Charset.defaultCharset())[0] // TODO: Verify
      for (i in 0 until temp.size) {
        if (temp[index] == newLineCode) {
          break
        }
        index = i
      }

      val jsonStr = String(temp.slice(IntRange(0, index)).toByteArray())
      val wo      = WireObject.getWireObject(JSONObject(jsonStr)) as WireObject
      val outAr   = temp.slice(IntRange(index+1, temp.size-1))

      wo.data = outAr.toByteArray()
      decLen  =  outAr.size
      arData.add(wo)

    } else {

      deflated = leader == DataLeader.DEF_JSON.toByte() || leader == DataLeader.ENC_DEF_JSON.toByte()
      val inJsonStr = if (deflated) String(CryptoBase.inflate(temp)) else String(temp)

      decLen   = inJsonStr.length
      val json = JSONTokener(inJsonStr).nextValue()

      if (json is JSONObject) {
        val obj = WireObject.getWireObject(json) as WireObject
        arData.add(obj)

      } else if (json is JSONArray) {
        for (i in 0 until json.length()) {
          val jsonObj = JSONObject(json.getString(i))
          val obj     = WireObject.getWireObject(jsonObj) as WireObject
          arData.add(obj)
        }
      }

      info { "decodeBody,\n" +
             "first       : ${arData[0].name}, \n" +
             "messages    : ${arData.size}, \n" +
             "wire        : ${bytes.size}, \n" +
             "message     : $decLen,\n" +
             "encrypted   : true,\n" +
             "compressed  : $deflated"}
    }

    return arData
  }

  fun setNewKey(syncKey: String) {
    this.syncKey = base64ToByteArray(syncKey)
  }

  private fun strToByteArray(str: String): ByteArray = str.toByteArray(Charset.defaultCharset())

  private fun stringifyWireObjects(objects: Array<WireObject>): String {

    val strObjs: Array<String> = Array(objects.size) {
      objects[it].stringify()
    }

    return "[${strObjs.joinToString(", ")}]"
  }

  // 2 way encryption decryption
  // https://docs.oracle.com/javase/8/docs/technotes/guides/security/crypto/CryptoSpec.html#AppA
  private fun encryptDecrypt(inpBytes: ByteArray, decrypt: Boolean = false): ByteArray {
    val newKey = SecretKeySpec(this.syncKey, "AES")
    val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
    cipher.init(if (decrypt) Cipher.DECRYPT_MODE else Cipher.ENCRYPT_MODE, newKey, ivSpec)
    return cipher.doFinal(inpBytes)
  }

  // Encryption of sym key using public key
  private fun encryptKey(): ByteArray {
    val cipher = Cipher.getInstance("RSA/NONE/OAEPPADDING")
    val pubKeySpec = X509EncodedKeySpec(rsaPubKey)
    val fact = KeyFactory.getInstance("RSA")
    cipher.init(Cipher.ENCRYPT_MODE, fact.generatePublic(pubKeySpec))
    return cipher.doFinal(this.syncKey)
  }

}