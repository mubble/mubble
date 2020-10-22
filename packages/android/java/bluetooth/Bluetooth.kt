package bluetooth

import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.content.Intent
import androidx.core.app.ActivityCompat
import kotlin.collections.ArrayList

/**
 * Created by Shubham Bhiwaniwala on 2020-01-07.
 */

val BLUETOOTH_REQUST_CODE : Int = 10001

class Bluetooth {

    private var activity        : Activity
    private var btAdapter       : BluetoothAdapter

    constructor(activity : Activity) {
        this.activity    = activity
        btAdapter       = BluetoothAdapter.getDefaultAdapter();
    }

    fun enableBluetooth() {

        if (!btAdapter.isEnabled()) {
            val enableBluetooth = Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE)
            ActivityCompat.startActivityForResult(activity, enableBluetooth, BLUETOOTH_REQUST_CODE, null)
        }
    }

    fun disableBluetooth() {
    }

    fun getPairedDevices() : ArrayList<String>? {

        if (btAdapter.isEnabled()) {
            var pairedDeviceList : ArrayList<String>    = ArrayList<String>()
            val pairedDevices                           = btAdapter.getBondedDevices()
            for (device in pairedDevices) { pairedDeviceList.add(device.name) }
            return pairedDeviceList
        } else {
            return null
        }

    }

    fun connectTo(pairedDeviceName : String) : BluetoothDevice? {

        if (!btAdapter.isEnabled()) return null

        val pairedDevices = btAdapter.getBondedDevices()
        for (device in pairedDevices) {
            if(device.name == pairedDeviceName) {
                return device
            }
        }
        return null

    }

}