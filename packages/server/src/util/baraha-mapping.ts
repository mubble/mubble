// ASCII2Unicode Kannada Text Encoding converter
// Copyright (C) 2011, 2012 Aravinda VK <hallimanearavind@gmail.com>
//                                      <http://aravindavk.in>

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

export const mapping : { [index: string]: string } = {
  "C": "ಅ",
  "D": "ಆ",
  "E": "ಇ",
  "F": "ಈ",
  "G": "ಉ",
  "H": "ಊ",
  "IÄ": "ಋ",
  "J": "ಎ",
  "K": "ಏ",
  "L": "ಐ",
  "M": "ಒ",
  "N": "ಓ",
  "O": "ಔ",
  "A": "ಂ",
  "B": "ಃ",
  "Pï": "ಕ್",
  "PÀ": "ಕ",
  "PÁ": "ಕಾ", 
  "Q": "ಕಿ",
  "PÉ": "ಕೆ",
  "PË": "ಕೌ",
  "Sï": "ಖ್",
  "R": "ಖ",
  "SÁ": "ಖಾ",
  "T": "ಖಿ",
  "SÉ": "ಖೆ",
  "SË": "ಖೌ",
  "Uï": "ಗ್",
  "UÀ": "ಗ",
  "UÁ": "ಗಾ",
  "V": "ಗಿ",
  "UÉ": "ಗೆ",
  "UË": "ಗೌ",
  "Wï": "ಘ್",
  "WÀ": "ಘ",
  "WÁ": "ಘಾ",
  "X": "ಘಿ",
  "WÉ": "ಘೆ",
  "WË": "ಘೌ",
  "k": "ಞ",
  "Zï": "ಚ್",
  "ZÀ": "ಚ",
  "ZÁ": "ಚಾ",
  "a": "ಚಿ",
  "ZÉ": "ಚೆ",
  "ZË": "ಚೌ",
  "bï": "ಛ್",
  "bÀ": "ಛ",
  "bÁ": "ಛಾ",
  "c": "ಛಿ",
  "bÉ": "ಛೆ",
  "bË": "ಛೌ",
  "eï": "ಜ್",
  "d": "ಜ",
  "eÁ": "ಜಾ",
  "f": "ಜಿ",
  "eÉ": "ಜೆ",
  "eË": "ಜೌ",
  "gÀhiï": "ಝ್",
  "gÀhÄ": "ಝ",
  "gÀhiÁ": "ಝಾ",
  "jhÄ": "ಝಿ",
  "gÉhÄ": "ಝೆ",
  "gÉhÆ": "ಝೊ",
  "gÀhiË": "ಝೌ",
  "Y" : "ಙ",
  "mï": "ಟ್",
  "l": "ಟ",
  "mÁ": "ಟಾ",
  "n": "ಟಿ",
  "mÉ": "ಟೆ",
  "mË": "ಟೌ",
  "oï": "ಠ್",
  "oÀ": "ಠ",
  "oÁ": "ಠಾ",
  "p": "ಠಿ",
  "oÉ": "ಠೆ",
  "oË": "ಠೌ",
  "qï": "ಡ್",
  "qÀ": "ಡ",
  "qÁ": "ಡಾ",
  "r": "ಡಿ",
  "qÉ": "ಡೆ",
  "qË": "ಡೌ",
  "qsï": "ಢ್",
  "qsÀ": "ಢ",
  "qsÁ": "ಢಾ",
  "rü": "ಢಿ",
  "qsÉ": "ಢೆ",
  "qsË": "ಢೌ",
  "uï": "ಣ್",
  "t": "ಣ",
  "uÁ": "ಣಾ",
  "tÂ": "ಣಿ",
  "uÉ": "ಣೆ",
  "uË": "ಣೌ",
  "vï": "ತ್",
  "vÀ": "ತ",
  "vÁ": "ತಾ",
  "w": "ತಿ",
  "vÉ": "ತೆ",
  "vË": "ತೌ",
  "xï": "ಥ್",
  "xÀ": "ಥ",
  "xÁ": "ಥಾ",
  "y": "ಥಿ",
  "xÉ": "ಥೆ",
  "xË": "ಥೌ",
  "zï": "ದ್",
  "zÀ": "ದ",
  "zÁ": "ದಾ",
  "¢": "ದಿ",
  "zÉ": "ದೆ",
  "zË": "ದೌ",
  "zsï": "ಧ್",
  "zsÀ": "ಧ",
  "zsÁ": "ಧಾ",
  "¢ü": "ಧಿ",
  "zsÉ": "ಧೆ",
  "zsË": "ಧೌ",
  "£ï": "ನ್",
  "£À": "ನ",
  "£Á": "ನಾ",
  "¤": "ನಿ",
  "£É": "ನೆ",
  "£Ë": "ನೌ",
  "¥ï": "ಪ್",
  "¥À": "ಪ",
  "¥Á": "ಪಾ",
  "¦": "ಪಿ",
  "¥É": "ಪೆ",
  "¥Ë": "ಪೌ",
  "¥sï": "ಫ್",
  "¥sÀ": "ಫ",
  "¥sÁ": "ಫಾ",
  "¦ü": "ಫಿ",
  "¥sÉ": "ಫೆ",
  "¥sË": "ಫೌ",
  "¨ï": "ಬ್",
  "§": "ಬ",
  "¨Á": "ಬಾ",
  "©": "ಬಿ",
  "¨É": "ಬೆ",
  "¨Ë": "ಬೌ",
  "¨sï": "ಭ್",
  "¨sÀ": "ಭ",
  "¨sÁ": "ಭಾ",
  "©ü": "ಭಿ",
  "¨sÉ": "ಭೆ",
  "¨sË": "ಭೌ",
  "ªÀiï": "ಮ್",
  "ªÀÄ": "ಮ",
  "ªÀiÁ": "ಮಾ",
  "«Ä": "ಮಿ",
  "ªÉÄ": "ಮೆ",
  "ªÀiË": "ಮೌ",
  "AiÀiï": "ಯ್",
  "AiÀÄ": "ಯ",
  "0iÀÄ": "ಯ",
  "AiÀiÁ": "ಯಾ",
  "0iÀiÁ": "ಯಾ",
  "¬Ä": "ಯಿ",
  "0iÀÄÄ": "ಯು",
  "AiÉÄ": "ಯೆ",
  "0iÉÆ": "ಯೊ",
  "AiÉÆ": "ಯೊ",
  "AiÀiË": "ಯೌ",
  "gï": "ರ್",
  "gÀ": "ರ",
  "gÁ": "ರಾ",
  "j": "ರಿ",
  "gÉ": "ರೆ",
  "gË": "ರೌ",
  "¯ï": "ಲ್",
  "®": "ಲ",
  "¯Á": "ಲಾ",
  "°": "ಲಿ",
  "¯É": "ಲೆ",
  "¯Ë": "ಲೌ",
  "ªï": "ವ್",
  "ªÀ": "ವ",
  "ªÁ": "ವಾ",
  "«": "ವಿ",
  "ªÀÅ":"ವು",
  "ªÀÇ":"ವೂ",
  "ªÉ":"ವೆ",
  "ªÉÃ":"ವೇ",
  "ªÉÊ":"ವೈ",
  "ªÉÆ": "ಮೊ",
  "ªÉÆÃ": "ಮೋ",
  "ªÉÇ":"ವೊ",
  "ªÉÇÃ":"ವೋ",
  "ªÉ  ": "ವೆ",
  "¥ÀÅ": "ಪು",
  "¥ÀÇ" : "ಪೂ",
  "¥sÀÅ" : "ಫು", 
  "¥sÀÇ" : "ಫೂ",
  "ªË": "ವೌ",
  "±ï": "ಶ್",
  "±À": "ಶ",
  "±Á": "ಶಾ",
  "²": "ಶಿ",
  "±É": "ಶೆ",
  "±Ë": "ಶೌ",
  "µï": "ಷ್",
  "µÀ": "ಷ",
  "μÀ": "ಷ",
  "µÁ": "ಷಾ",
  "¶": "ಷಿ",
  "µÉ": "ಷೆ",
  "µË": "ಷೌ",
  "¸ï": "ಸ್",
  "¸À": "ಸ",
  "¸Á": "ಸಾ",
  "¹": "ಸಿ",
  "¸É": "ಸೆ",
  "¸Ë": "ಸೌ",
  "ºï": "ಹ್",
  "ºÀ": "ಹ",
  "ºÁ": "ಹಾ",
  "»": "ಹಿ",
  "ºÉ": "ಹೆ",
  "ºË": "ಹೌ",
  "¼ï": "ಳ್",
  "¼À": "ಳ",
  "¼Á": "ಳಾ",
  "½": "ಳಿ",
  "¼É": "ಳೆ",
  "¼Ë": "ಳೌ"
};

export type broken_cases_mapping_type = {
  value: string
  mapping: { [index: string] : string }
}

// These when joined will be broken as per unicode 
export const broken_cases : { [index: string] : broken_cases_mapping_type }= {
  "Ã":{
      "value": "ೀ",
      "mapping": {
          "ಿ": "ೀ",
          "ೆ": "ೇ",
          "ೊ": "ೋ"
          }
      }, 
  "Ä":{
      "value": "ು",
      "mapping": {
          
          }
      }, 
  "Æ":{
      "value": "ೂ",
      "mapping": {
          "ೆ":"ೊ"
          }
      }, 
  "È":{
      "value": "ೃ",
      "mapping": {
          
          }
      }, 
  "Ê":{
      "value": "ೈ",
      "mapping": {
          "ೆ":"ೈ"
          }
      }  
  };

export const dependent_vowels: Array<string> = ["್", "ಾ", "ಿ", "ೀ", "ು", "ೂ", "ೃ", "ೆ", "ೇ", "ೈ", "ೊ", "ೋ", "ೌ"];
export const  ignore_list : { [index: string]: string } = {"ö": "", "÷": ""};

export const  vattaksharagalu : { [index: string]: string } = {
  "Ì": "ಕ",
  "Í": "ಖ",
  "Î": "ಗ",
  "Ï": "ಘ",
  "Õ": "ಞ",
  "Ñ": "ಚ",
  "Ò": "ಛ",
  "Ó": "ಜ",
  "Ô": "ಝ",
  "Ö": "ಟ",
  "×": "ಠ",
  "Ø": "ಡ",
  "Ù": "ಢ",
  "Ú": "ಣ",
  "Û": "ತ",
  "Ü": "ಥ",
  "Ý": "ದ",
  "Þ": "ಧ",
  "ß": "ನ",
  "à": "ಪ",
  "á": "ಫ",
  "â": "ಬ",
  "ã": "ಭ",
  "ä": "ಮ",
  "å": "ಯ",
  "æ": "ರ",
  "è": "ಲ",
  "é": "ವ",
  "ê": "ಶ",
  "ë": "ಷ",
  "ì": "ಸ",
  "í": "ಹ",
  "î": "ಳ",
  "ç": "ರ"
};

export const ascii_arkavattu : { [index: string]: string } = {
  "ð": "ರ"
}

