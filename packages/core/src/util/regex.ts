/*------------------------------------------------------------------------------
   About      : Helper regex to save code writing and compute
   
   Created on : Fri Apr 07 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

/*

Character  Matches
[...]      Any one character between the brackets.
[^...]     Any one character not between the brackets.
.          Any character except newline or another Unicode line terminator.
\w         Any ASCII word character. Equivalent to [a-zA-Z0-9_].
\W         Any character that is not an ASCII word character. Equivalent to [^a-zA-Z0-9_].
\s         Any Unicode whitespace character.
\S         Any character that is not Unicode whitespace. Note that \w and \S are not the same thing.
\d         Any ASCII digit. Equivalent to [0-9].
\D         Any character other than an ASCII digit. Equivalent to [^0-9].
[\b]       A literal backspace (special case).

*/

// A name can only consist of alphanumeric and _
const RX_VALID_NAME = /^\w+$/

export class Validator {

  static isValidName(s: string): boolean {
    return RX_VALID_NAME.test(s)
  }

}



