package qrcodescan;

import com.google.firebase.ml.vision.barcode.FirebaseVisionBarcode;

import java.util.List;

public interface ResultListener {

    void setResult(List<FirebaseVisionBarcode> barcodes);
}
