package bluetooth

/**
 * Created by Shubham Bhiwaniwala on 2020-01-07.
 */

interface Printer {
    fun initializePrinter()
    fun printData(bytes : ByteArray)
    fun cancelPrint()
    fun disconnect()
}