import { MaskingDataParams } from "./rc-base";

export class DataMasker {

  constructor() {
     
  }

  static maskData(maskingData : MaskingDataParams, data : string ) {

    const dataLength  = data.length

    let maskedData = null

    let startSkipCount  = maskingData.startSkipCount || 0,
        endSkipCount    = maskingData.endSkipCount  || 0,
        maskLength      = dataLength - startSkipCount - endSkipCount
    
    if ((startSkipCount + endSkipCount) > dataLength) {
      maskLength      = dataLength
      startSkipCount  = 0
      endSkipCount    = 0
    }

    if (!maskedData) {
      maskedData  = data.substr(0, startSkipCount) + `${maskingData.maskWith || '*'}`.repeat(maskLength) + 
                    data.substr(dataLength - endSkipCount);
    }

    return maskedData        
  }

}