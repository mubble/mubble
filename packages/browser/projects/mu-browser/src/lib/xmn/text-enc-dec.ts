const utf8Encodings = ['utf8', 'utf-8']

export class TextEncDec {

  constructor(encFormat : string) {

    if (utf8Encodings.indexOf(encFormat) < 0 && typeof encFormat !== 'undefined' && encFormat != null) {
      throw new RangeError('Invalid encoding type. Only utf-8 is supported')
    } 

  }

  encode(str : string) {

    if (typeof str !== 'string') {
      throw new TypeError('passed argument must be of tye string')
    }

    const binstr  = unescape(encodeURIComponent(str)),
          uar     = new Uint8Array(binstr.length),
          split   = binstr.split('')

    for (let i = 0; i < split.length; i++) {
      uar[i] = split[i].charCodeAt(0)
    }
    return uar
  }

  decode(uar : Uint8Array) {

    if (typeof uar === 'undefined') {
      return ''
    }

    if (!ArrayBuffer.isView(uar)) {
      throw new TypeError('passed argument must be an array buffer view')
    } else {
      const arr     = new Uint8Array(uar.buffer, uar.byteOffset, uar.byteLength),
            charArr = new Array(arr.length)

      for (let i = 0; i < arr.length; i++) {
        charArr[i] = String.fromCharCode(arr[i])
      }

      return decodeURIComponent(escape(charArr.join('')))
    }
  }
}
