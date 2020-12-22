package ui.auth
import android.content.ContentResolver
import android.content.Context
import android.provider.ContactsContract
import org.json.JSONArray
import org.json.JSONObject
import ui.permission.PermissionGroup
import java.util.regex.Pattern


/**
--------------------------------------------------
About      : <Write about the file here>

Created on : 9/10/20
Author     : siddharth

--------------------------------------------------
 */

class ContactsManager {

	companion object {

		private var inst : ContactsManager? = null

		private const val NAME 					= "name"
		private const val PHOTO 				= "photo"
		private const val PHONE_NUMBERS = "numbers"

		private val PROJECTION: Array<out String> = arrayOf(
				ContactsContract.Contacts._ID,
				ContactsContract.Contacts.LOOKUP_KEY,
				ContactsContract.Contacts.DISPLAY_NAME,
				ContactsContract.Contacts.PHOTO_THUMBNAIL_URI,
				ContactsContract.Contacts.HAS_PHONE_NUMBER)

		fun getInstance(): ContactsManager =
				inst ?: synchronized(this) {
					inst ?: ContactsManager().also { inst = it }
				}
	}

	fun getAllContacts(context: Context, indianNumsOnly : Boolean, listener: (JSONArray) -> Unit) {

		val contacts = JSONArray()

		if (!PermissionGroup.CONTACTS.hasPermission(context)) {
			listener(contacts)
			return
		}

		val cr: ContentResolver = context.contentResolver
		val cur = cr.query(ContactsContract.Contacts.CONTENT_URI,
				PROJECTION, null, null, null)

		if (cur != null && cur.count > 0) {

			while (cur.moveToNext()) {

				if (cur.getInt(cur.getColumnIndex(ContactsContract.Contacts.HAS_PHONE_NUMBER)) > 0) {

					val id   	= cur.getString(cur.getColumnIndex(ContactsContract.Contacts._ID))
					val name 	= cur.getString(cur.getColumnIndex(ContactsContract.Contacts.DISPLAY_NAME))
					val photo = cur.getString(cur.getColumnIndex(ContactsContract.Contacts.PHOTO_THUMBNAIL_URI))

					val contact = JSONObject()
					contact.put(NAME, name)
					contact.put(PHOTO, photo)

					val phoneCur = cr.query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
							null, ContactsContract.CommonDataKinds.Phone.CONTACT_ID + " = ?",
							arrayOf(id), null)

					val numbers = JSONArray()

					while (phoneCur != null && phoneCur.moveToNext()) {
						var phoneNo = phoneCur.getString(phoneCur.getColumnIndex(
								ContactsContract.CommonDataKinds.Phone.NUMBER))

						phoneNo = phoneNo.replace("\\s", "")

						if (indianNumsOnly) {
							val pattern = "^\\+91[9876]\\d{9}\$"
							if (Pattern.compile(pattern).matcher(phoneNo).matches()) {
								numbers.put(phoneNo)
							}
						} else {
							numbers.put(phoneNo)
						}
					}

					if (numbers.length() > 0) {
						contact.put(PHONE_NUMBERS, numbers)
						contacts.put(contact)
					}

					phoneCur?.close()
				}
			}
		}

		cur?.close()
		listener(contacts)
	}

}