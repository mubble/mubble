package bluetooth

import android.app.Activity
import android.app.AlertDialog
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.widget.Toast
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.util.*
import kotlin.collections.ArrayList

/**
 * Created by Shubham Bhiwaniwala on 2020-01-07.
 */
class BluetoothPrinter(private var activity: Activity, private var cb: () -> Unit) : Printer {

    private var bluetooth           : Bluetooth = Bluetooth(activity)
    private var connDevice          : BluetoothDevice? = null
    private var btSocket            : BluetoothSocket?  = null

    private var btOutputStream      : OutputStream?     = null
    private var btInputStream       : InputStream?      = null
    private var workerThread        : Thread?       = null

    private var readBuffer          : ByteArray?    = null
    private var readBufferPosition  : Int           = 0

    @Volatile
    private var stopWorker          : Boolean       = false

    override fun initializePrinter() {
        bluetooth.enableBluetooth()
        val list = bluetooth.getPairedDevices()

        if (list == null) {
            Toast.makeText(activity, "Enable bluetooth first", Toast.LENGTH_SHORT).show()
            return
        }
        this.showPairedDevices(list)
    }

    override fun printData(bytes : ByteArray) {
        try {
            btOutputStream!!.write(bytes)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun cancelPrint() {

        stopWorker = true

        btOutputStream!!.close()
        btInputStream!!.close()

        btInputStream   = btSocket!!.inputStream
        btOutputStream  = btSocket!!.outputStream

        bluetooth.connectTo(connDevice!!.name)
    }

    override fun disconnect() {
        try {
            stopWorker = true
            btOutputStream!!.close()
            btInputStream!!.close()
            btSocket!!.close()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun createPrinterConnection() {
        try {

            val uuid    = UUID.fromString("00001101-0000-1000-8000-00805f9b34fb")
            btSocket    = connDevice!!.createRfcommSocketToServiceRecord(uuid)

            btSocket!!.connect()

            btOutputStream  = btSocket!!.outputStream
            btInputStream   = btSocket!!.inputStream

            startListener()

        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun showPairedDevices(list : ArrayList<String>) {
        val builder = AlertDialog.Builder(activity)
        builder.setTitle("Select Paired Device")

        val arr = arrayOfNulls<String>(list.size)
        for((i, deviceName) in list.withIndex()) {
            arr[i] = deviceName
        }

        builder.setItems(arr) { dialog, which ->
            dialog.dismiss()
            connDevice = bluetooth.connectTo(list[which])

            if (connDevice == null) {
                Toast.makeText(activity, "Could not find device", Toast.LENGTH_SHORT).show()
            } else {
                createPrinterConnection()
                cb()
            }
        }

        builder.show()
    }

    private fun startListener() {
        try {
            val delimiter: Byte = 10

            stopWorker          = false
            readBufferPosition  = 0
            readBuffer          = ByteArray(1024)

            workerThread        = Thread(Runnable {
                while (!Thread.currentThread().isInterrupted && !stopWorker) {

                    try {
                        val bytesAvailable = btInputStream!!.available()
                        if (bytesAvailable > 0) {

                            val packetBytes = ByteArray(bytesAvailable)
                            btInputStream!!.read(packetBytes)

                            for (i in 0 until bytesAvailable) {
                                val b = packetBytes[i]
                                if (b == delimiter) {
                                    val encodedBytes    = ByteArray(readBufferPosition)
                                    System.arraycopy(readBuffer!!, 0, encodedBytes, 0, encodedBytes.size)
//                                    val data            = String(encodedBytes, Charset.defaultCharset())
                                    readBufferPosition  = 0

                                } else {
                                    readBuffer!![readBufferPosition++] = b
                                }
                            }
                        }

                    } catch (ex: IOException) {
                        stopWorker = true
                    }

                }
            })

            workerThread!!.start()

        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

}