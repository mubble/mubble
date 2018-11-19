/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Tue Apr 11 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December']
    

export function format(dt:number|Date, formatStr: string, tzOffset?: number) : string {
  
  const date = dt instanceof Date ? dt as Date : new Date(dt as number)
  if (tzOffset !== undefined) {
    const time = date.getTime() + (date.getTimezoneOffset() - tzOffset) * 60 * 1000
    date.setTime(time)
  }
    
  // +? is a non-greedy repeat
  return formatStr.replace(/%\w+?%/g, function(token): any {
    function get12Hour(date: Date) {
      let hours = date.getHours()
      if (hours > 12) hours -= 12
      if (hours === 0) hours = 12
      return hours
    }
    
    function doubleDigit(val: number) {
      return ('0' + String(val)).slice(-2)
    }
    
    token = token.slice(1, -1)
    
    switch (token) {
    case 'yyyy':
      return date.getFullYear()
    case 'yy':
      return doubleDigit(date.getFullYear())
    case 'y':
      return Number(doubleDigit(date.getFullYear()))
    case 'mmmm':
      return MONTHS[date.getMonth()]
    case 'mmm':
      return MONTHS[date.getMonth()].substr(0, 3)
    case 'mm':
      return doubleDigit(date.getMonth()+1)
    case 'm':
      return date.getMonth()+1
    case 'dd':
      return doubleDigit(date.getDate())
    case 'd':
      return date.getDate()
    case 'hh': // max 23
      return doubleDigit(date.getHours())
    case 'h':
      return date.getHours()
    case 'HH': // max 12
      return doubleDigit(get12Hour(date))
    case 'H':
      return get12Hour(date)
    case 'MM': 
    case 'nn': 
      return doubleDigit(date.getMinutes())
    case 'M':
    case 'n': 
      return date.getMinutes()
    case 'SS': 
    case 'ss': 
      return doubleDigit(date.getSeconds())
    case 'S':
    case 's':
      return date.getSeconds()
    case 'ms':
      return ('00' + String(date.getMilliseconds())).slice(-3)
    case 'am':
    case 'pm':
      return date.getHours() > 11 ? 'pm' : 'am'
    case 'AM':
    case 'PM':
      return date.getHours() > 11 ? 'PM' : 'AM'
    default:
      return '%' + token + '%'
    }
  })
}

// var dt = new Date(0)
// mu(dt).set("27/10/2015 00:00", "%dd%/%mm%/%yyyy% %HH%:%MM%")
export function set(dt: number | Date, str: string, formatStr: string, tzOffset ?: number) : Date {

  const date: Date = dt instanceof Date ? dt as Date : new Date(dt as number)

  function getNumber(maxDigits: number) {
    var r = new RegExp('\\d{1,' + maxDigits + '}'),
        strNum = r.exec(str.substr(ptrStr))
    if (strNum !== null) {
      ptrStr += strNum[0].length
      return Number(strNum)
    }
    return null
  }
  
  function doMonth(short: boolean) {
    var months = MONTHS, 
        mon, i
    for (i = 0; i < 12; i++) {
      mon = (short ? months[i].substr(0, 3) : months[i]).toLowerCase()
      if (str.substr(ptrStr, mon.length).toLowerCase() === mon) {
        ptrStr += mon.length
        date.setMonth(i)
        break
      }
    }
  }
  
  let regEx     = new RegExp('%\\w+?%', 'g'), 
      foundPM   = false, 
      foundHH   = false, 
      ptrRegEx  = 0, 
      ptrStr    = 0, 
      num, time, match
  
  while ((match = regEx.exec(formatStr)) != null) {
    if (match.length !== 1) break
    match = match[0]
    ptrStr += (regEx.lastIndex - ptrRegEx) - match.length
    ptrRegEx = regEx.lastIndex
    const token: string = String(match.slice(1, -1))
    
    switch (token) {
    case 'yyyy':
    case 'yy':
    case 'y':
      num = getNumber(token.length === 4 ? 4 : 2)
      if (num !== null) {
        if (num < 100) num += 2000
        date.setFullYear(num)
      }
      break
      
    case 'mmmm':
    case 'mmm':
      doMonth(token === 'mmm')
      break
      
    case 'mm':
    case 'm':
      num = getNumber(2)
      if (num !== null) date.setMonth(num - 1)
      break
      
    case 'dd':
    case 'd':
      num = getNumber(2)
      if (num !== null) date.setDate(num)
      break
      
    case 'hh': // max 23
    case 'h':
      num = getNumber(2)
      if (num !== null) date.setHours(num)
      break
      
    case 'HH': // max 12
    case 'H':
      num = getNumber(2)
      if (num !== null) {
        date.setHours(num === 12 ? 0 : num)
        foundHH = true
      }
      break
      
    case 'MM': // max 23
    case 'M':
    case 'nn':
    case 'n':
      num = getNumber(2)
      if (num !== null) date.setMinutes(num)
      break
      
    case 'SS': // max 23
    case 'S': 
    case 'ss':
    case 's':
      num = getNumber(2)
      if (num !== null) date.setSeconds(num)
      break
      
    case 'ms': // max 999
      num = getNumber(3)
      if (num !== null) date.setMilliseconds(num)
      break
      
    case 'am':
    case 'AM':
    case 'PM':
    case 'pm':
      const ampm:string = str.substr(ptrStr, 2).toLowerCase()
      if ((ampm === 'am') || (ampm === 'pm')) {
        ptrStr += 2
        if (ampm === 'pm') foundPM = true
      }
      break
      
    default:
      ptrStr += match.length
    }
  } // end while
  if (foundPM && foundHH) {
    date.setHours(date.getHours()+12)
  }
  
  if (tzOffset !== undefined) {
    time = date.getTime() + (date.getTimezoneOffset() + tzOffset) * 60 * 1000
    date.setTime(time)
  }
  
  return date
}

