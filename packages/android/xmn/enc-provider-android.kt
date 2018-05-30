package `in`.mubble.android.xmn

import `in`.mubble.android.core.MubbleLogger
import org.java_websocket.util.Base64
import org.jetbrains.anko.info
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import util.CryptoBase
import xmn.Encoder
import xmn.Leader
import xmn.WireObject
import java.nio.charset.Charset
import java.security.KeyFactory
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

class EncProviderAndroid(private val syncKey : ByteArray,
                         private val ci      : ConnectionInfo) : MubbleLogger {

  companion object {
    // not making these thread safe as these are used once at app load time
    private var initialized = false
    private val arShortCode: ByteArray = ByteArray(4)
    private val arUniqueId: ByteArray = ByteArray(3)

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
      var parts: List<Int> = ci.uniqueId.split('.').map {it.toInt()}
      if (parts.size > 1) {
        check(parts.size == 3 && parts[0] <= 99 && parts[1] <= 99 && parts[2] <= 99)
      } else {
        val num = parts[0]
        parts   = listOf(num / 10000, num % 10000 / 100 , num % 100)
      }

      for (part in parts) arUniqueId[index++] = part.toByte()
    }

  }

  private val ivSpec = IvParameterSpec(ByteArray(16))


  init {
    EncProviderAndroid.init(ci)

    // Generate random key for communication
    //SecureRandom().nextBytes(ci.syncKey)
  }

  fun encodeHeader(): ByteArray {

    /*
      this.ci.syncKey: Sym key that is generated by client and then changed by server
      this.syncKey: Public key that is used to protect this.ci.syncKey
    */

    val encKey = if (!this.ci.useEncryption) ByteArray(0) else encryptKey()

    val obj = if (this.ci.clientIdentity != null) this.ci.clientIdentity!!.toJsonObject() else JSONObject()
    obj.put("networkType", this.ci.networkType)
    obj.put("location", this.ci.location)
    obj.put("now", System.currentTimeMillis())

    val header  = strToByteArray(obj.toString())
    val arOut   = ByteArray(arShortCode.size + arUniqueId.size + encKey.size + header.size)
    var copied  = 0

    for (i in 0 until arShortCode.size) arOut[i] = arShortCode[i]
    copied += arShortCode.size

    for (i in 0 until arUniqueId.size) arOut[copied+i] = arUniqueId[i]
    copied += arUniqueId.size

    if (this.ci.syncKey.isNotEmpty()) {
      for (i in 0 until encKey.size) arOut[copied+i] = encKey[i]
      copied += encKey.size
    }

    for (i in 0 until header.size) arOut[copied+i] = header[i]
    copied += header.size

    return arOut
  }

  fun encodeBody(data: Array<WireObject>): ByteArray {

    val str = stringifyWireObjects(data)

    var firstPassArray  : ByteArray? = null
    var leader          : Char?      = null

    if (str.length > Encoder.MIN_SIZE_TO_COMPRESS) {
      firstPassArray  = strToByteArray(str)
      leader          = Leader.DEF_JSON
    }

    if (firstPassArray == null) {
      firstPassArray  = strToByteArray(str)
      leader          = Leader.JSON
    }

    val arOut = ByteArray(firstPassArray.size + 1)
    arOut[0] = strToByteArray(leader.toString())[0]
    for (i in 0 until firstPassArray.size) arOut[i+1] = firstPassArray[i]

    info { "encodeBody,\n" +
           "first       : ${data[0].name}, \n" +
           "messages    : ${data.size}, \n" +
           "json        : ${str.length}, \n" +
           "wire        : ${arOut.size}, \n" +
           "encrypted   : ${this.ci.useEncryption}, \n" +
           "compressed  : ${leader == Leader.DEF_JSON}" }

    return arOut
  }

  fun decodeBody(bytes: ByteArray): MutableList<WireObject> {

    val inAr:List<Byte> = bytes.slice(1 until bytes.size)
    val leader          = String(bytes)[0]

    val arData: MutableList<WireObject> = mutableListOf()
    val decLen: Int

    var index = 0

    if (leader == Leader.BIN) {

      val newLineCode = "\n".toByteArray(Charset.defaultCharset())[0] // TODO: Verify
      for (i in 0 until inAr.size) {
        if (inAr[index] == newLineCode) {
          break
        }
        index = i
      }

      val jsonStr = String(inAr.slice(IntRange(0, index)).toByteArray())
      val wo      = WireObject.getWireObject(JSONObject(jsonStr)) as WireObject
      val outAr   = inAr.slice(IntRange(index+1, inAr.size-1))

      wo.data = JSONObject(String(outAr.toByteArray()))
      decLen  =  outAr.size
      arData.add(wo)

    } else {

      val inJsonStr = if (leader == Leader.DEF_JSON) {
        String(CryptoBase.inflate(inAr.toByteArray()))
      } else {
        String(inAr.toByteArray())
      }

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
             "encrypted   : ${this.ci.useEncryption},\n" }
    }

    return arData
  }

  fun setNewKey(syncKey: String) {

    assert(this.ci.useEncryption)

    val newKey = Base64.decode(syncKey.toByteArray(), 0,
        syncKey.toByteArray().size, android.util.Base64.DEFAULT)

    this.ci.syncKey = encryptDecrypt(newKey, true)
  }

  private fun strToByteArray(str: String): ByteArray = str.toByteArray(Charset.defaultCharset())

  private fun stringifyWireObjects(objects: Array<WireObject>): String {

    val strObjs: Array<String> = Array(objects.size, {
      objects[it].stringify()
    })

    return "[${strObjs.joinToString(", ")}]"
  }

  // 2 way encryption decryption
  // https://docs.oracle.com/javase/8/docs/technotes/guides/security/crypto/CryptoSpec.html#AppA
  private fun encryptDecrypt(inpBytes: ByteArray, decrypt: Boolean = false): ByteArray {
    val newKey = SecretKeySpec(ci.syncKey, "AES")
    val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
    cipher.init(if (decrypt) Cipher.DECRYPT_MODE else Cipher.ENCRYPT_MODE, newKey, ivSpec)
    return cipher.doFinal(inpBytes)
  }

  // Encryption of sym key using public key
  private fun encryptKey(): ByteArray {
    val cipher = Cipher.getInstance("RSA/ECB/PKCS1PADDING")
    val pubKeySpec = X509EncodedKeySpec(syncKey)
    val fact = KeyFactory.getInstance("RSA", "BC")
    cipher.init(Cipher.ENCRYPT_MODE, fact.generatePublic(pubKeySpec))
    return cipher.doFinal(ci.syncKey)
  }

}