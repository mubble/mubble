/*------------------------------------------------------------------------------
   About      : Https utils
   
   Created on : Thu Mar 05 2020
   Author     : Yatharth Patel
   
   Copyright (c) 2020 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import { 
         Mubble, 
         HTTP,
         format
       }                        from '@mubble/core'
import { UStream }              from '.'
import { RunContextServer }     from '../rc-server'
import * as http                from 'http'
import * as https               from 'https'
import * as winston             from 'winston'
import * as url                 from 'url'
import * as stream              from 'stream'
import * as zlib                from 'zlib'
import * as DailyRotateFile     from 'winston-daily-rotate-file'
import * as lo                  from 'lodash'
import * as path                from 'path'
import * as fs                  from 'fs'

const STRING_TYPE        = 'string',
      OBJECT_TYPE        = 'object',
      DEFAULT_TIMEOUT_MS = 60000,
      ECONNRESET         = 'ECONNRESET',
      NO_EXTRA_LOG_INFO  = 'NO_EXTRA_LOG_INFO'

export type Response = {
  timeTakenMs : number
  response    : string
  statusCode  : number
  headers     : Mubble.uObject<any>
}

export type LogResult = {
  // request
  requestId         : string
  requestTs         : number
  url               : string
  requestTimeoutTs  : number
  requestHeaders   ?: Mubble.uObject<any>
  payload           : string

  timeTakenMs       : number

  // response
  responseTs       ?: number
  status           ?: number
  responseHeaders  ?: Mubble.uObject<any> 
  response         ?: string

  // error
  error            ?: Error

  // timeout
  timedOut         ?: boolean

  //extraLogInfo
  extraLogInfo     ?: string
}

type Request = {
  url     : string,
  options : http.RequestOptions,
  data    : string
}

type Timeout = {
  timeTakenMs : number
  timeoutMs   : number
}

type ErrorResp = {
  timeTakenMs : number
  error       : Error
}

enum LOG_ID {
  REQUEST  = 'REQUEST',
  RESPONSE = 'RESPONSE',
  TIMEOUT  = 'TIMEOUT',
  ERROR    = 'ERROR'
}

type LogData = {
  date          : string
  time          : string
  requestId     : string
  logId         : LOG_ID
  extraLogInfo ?: string
  requestObj    : Request
  otherObj     ?: Response | ErrorResp | Timeout
}

export class HttpsRequest {

  private logger   : winston.Logger  
  private logPath  : string  

  constructor(rc : RunContextServer, logBaseDir : string, private hostname : string) {

    rc.isDebug() && rc.debug(rc.getName(this), 'Constructing HttpsRequest.')

    this.logPath = logBaseDir

    this.hostname = hostname.replace('.', '-')
    this.createLogger()
  }
                     
  async executeRequest(rc            : RunContextServer,
                       urlObj        : url.UrlObject,
                       options      ?: http.RequestOptions,
                       data         ?: Mubble.uObject<any> | string,
                       extraLogInfo ?: string) : Promise<Response> {                        

    const requestId = `req-${lo.random(100000, 999999, false)}`                     

    rc.isDebug() && rc.debug(rc.getName(this), requestId, 'executeHttpRequest', urlObj, options, data)

    const request    : Request             = {} as Request,
          start      : number              = Date.now(),
          reqOptions : http.RequestOptions = options ? options : urlObj,
          dataStr    : string              = data
                                             ? typeof data === STRING_TYPE ? data as string
                                                                           : JSON.stringify(data)
                                             : ''

    const extraLogInfoStr : string = extraLogInfo ? extraLogInfo : NO_EXTRA_LOG_INFO                                                             
                                           
    request.options = reqOptions 
    request.data    = dataStr                                    

    if(!reqOptions.headers) reqOptions.headers = {}
    if(dataStr && !reqOptions.headers[HTTP.HeaderKey.contentLength]) {
      reqOptions.headers[HTTP.HeaderKey.contentLength] = dataStr.length
    }
    if(data && typeof data === OBJECT_TYPE && !reqOptions.headers[HTTP.HeaderKey.contentType]) {
      reqOptions.headers[HTTP.HeaderKey.contentType] = HTTP.HeaderValue.json
    }
    if(!reqOptions.timeout) reqOptions.timeout = DEFAULT_TIMEOUT_MS

    const urlStr  = url.format(urlObj),
          resp    = {} as Response

    request.url = urlStr      

    rc.isStatus() && rc.status(rc.getName(this), requestId, 'http(s) request.', urlStr, reqOptions, dataStr)

    this.logger.info('%s %s %s %s', requestId, LOG_ID.REQUEST, extraLogInfoStr, JSON.stringify(request))
    
    const req          = reqOptions.protocol === HTTP.Const.protocolHttp
                         ? http.request(urlStr, reqOptions)
                         : https.request(urlStr, reqOptions),
          writePromise = new Mubble.uPromise(),
          readPromise  = new Mubble.uPromise(),
          writeStreams = [] as Array<stream.Writable>,
          readStreams  = [] as Array<stream.Readable>

    writeStreams.push(req)      

    req.on('response', (res : http.IncomingMessage) => {

      rc.isDebug() && rc.debug(rc.getName(this), requestId, 'http(s) response headers.',
                               urlStr, res.statusCode, res.headers)                        

      resp.statusCode = res.statusCode || 200
      resp.headers    = res.headers

      readStreams.push(res)

      if(res.headers[HTTP.HeaderKey.contentEncoding]) {
        switch(res.headers[HTTP.HeaderKey.contentEncoding]) {
          case HTTP.HeaderValue.gzip :
            readStreams.push(zlib.createGunzip())
            break
          case HTTP.HeaderValue.deflate :
            readStreams.push(zlib.createInflate())
        }
      }

      const readUStream = new UStream.ReadStreams(rc, readStreams, readPromise)
      readUStream.read()
    })

    req.on('error', (err : Error) => {

      rc.isError() && rc.error(rc.getName(this), requestId, 'Error encountered in http(s) request.', err)                         

      const timeTakenMs = Date.now() - start

      const errorResp : ErrorResp = {
        timeTakenMs,
        error : err
      }

      const timeoutCond = (err as any).code === ECONNRESET && reqOptions.timeout && timeTakenMs > reqOptions.timeout

      if(!timeoutCond) {
        this.logger.info('%s %s %s %s %s', requestId, LOG_ID.ERROR, extraLogInfoStr,
                         JSON.stringify(request), JSON.stringify(errorResp))
      }
      writePromise.reject(err)
      readPromise.reject(err)
    })

    req.on('timeout', () => {

      const timeTakenMs = Date.now() - start

      rc.isError() && rc.error(rc.getName(this), requestId, 'http(s) request timed out.',
                               reqOptions.timeout, timeTakenMs)

      const timeout : Timeout = {
        timeTakenMs,
        timeoutMs : reqOptions.timeout || DEFAULT_TIMEOUT_MS
      }

      this.logger.info('%s %s %s %s %s', requestId, LOG_ID.TIMEOUT, extraLogInfoStr,
                       JSON.stringify(request), JSON.stringify(timeout))
      req.abort()
    })

    const writeUStream = new UStream.WriteStreams(rc, writeStreams, writePromise)
    writeUStream.write(dataStr)

    const [, output] : Array<any> = await Promise.all([writePromise.promise, readPromise.promise])
    resp.response    = output.toString()
    resp.timeTakenMs = Date.now() - start

    rc.isStatus() && rc.status(rc.getName(this), requestId, 'http(s) request response.', urlStr, resp.response)

    this.logger.info('%s %s %s %s %s', requestId, LOG_ID.RESPONSE, extraLogInfoStr,
                     JSON.stringify(request), JSON.stringify(resp))

    return resp
  }

  public extractResults(rc : RunContextServer, dateTs : number) : Array<LogResult> {

    const date     = format(dateTs, '%yyyy%-%mm%-%dd%'),
          filePath = path.join(this.logPath, `${this.hostname}-${date}.log`)

    rc.isDebug() && rc.debug(rc.getName(this), 'extractResults', 'Reading file.', filePath)

    const data     = fs.readFileSync(filePath).toString(),
          linesArr = data.split('\n')

    rc.isDebug() && rc.debug(rc.getName(this), 'extractResults', 'Converting lines to rows.', linesArr.length)

    const rowsArr    : Array<LogData>                 = this.convertLinesToRows(linesArr),
          rows       : Mubble.uObject<Array<LogData>> = lo.groupBy(rowsArr, 'requestId'),
          requestIds : Array<string>                  = Object.keys(rows),
          logResults : Array<LogResult>               = []

    for(const requestId of requestIds) {
      const row = rows[requestId]

      try {
        const logResult = this.convertToLogResult(requestId, row)

        logResults.push(logResult)
      } catch(e) {
        rc.isWarn() && rc.warn(rc.getName(this), 'Error in converting to log result. Not pushing in array', row, e)
      }
    }

    return logResults
  }

/*------------------------------------------------------------------------------
                          PRIVATE FUNCTIONS
------------------------------------------------------------------------------*/        
  
  private createLogger() {

    const logFormat = winston.format.combine(
                        winston.format.timestamp({ format : 'DD/MM/YYYY HH:mm:ss.SSS' }),
                        winston.format.splat(),                        
                        winston.format.printf(info => `${info.timestamp} ${info.message}`),
                      ),
          transport = new DailyRotateFile({
                        dirname     : this.logPath,
                        filename    : `${this.hostname}-%DATE%.log`,
                        datePattern : 'YYYY-MM-DD',
                        level       : 'info',
                        json        : true
                      })         
    
    this.logger = winston.createLogger({
                    format     : logFormat,
                    transports : transport
                  })           
                    
  }

  private convertLinesToRows(linesArr : Array<string>) : Array<LogData> {

    const requestIdMap : Mubble.uObject<boolean> = {},
          rowsArr      : Array<LogData>          = []

    for(const line of linesArr) {
      const words : Array<string> = line.split(' '),
            date                  = words.shift() as string,
            time                  = words.shift() as string,
            requestId             = words.shift() as string,
            logId                 = words.shift() as LOG_ID,
            restOfTheLog          = words.join(' '),
            restOfTheWords        = restOfTheLog.split(' {'),
            extraLogInfo          = restOfTheWords.shift() as string,
            objsStr               = '{' + restOfTheWords.join(' {')

      if(logId === LOG_ID.REQUEST) {

        let reqId = requestId + this.getDoubleDigits(0)

        for(let i = 1; i < 100; i++) {
          if(requestIdMap[reqId] === undefined) {
            break
          }

          reqId = requestId + this.getDoubleDigits(i)
        }

        requestIdMap[reqId] = false

        const logData : LogData = {
          date,
          time,
          requestId    : reqId,
          logId,
          extraLogInfo : extraLogInfo === NO_EXTRA_LOG_INFO ? undefined : extraLogInfo,
          requestObj   : JSON.parse(objsStr.trim())
        }

        rowsArr.push(logData)   
        continue
      }

      const regex = /\{.*\}\ /g,
            found = objsStr.match(regex)

      if(found) {

        let reqId = requestId + this.getDoubleDigits(0)

        for(let i = 1; i < 100; i++) {

          if(requestIdMap[reqId] === false) {

            const requestObj = JSON.parse(found[0].trim()),
                  otherObj   = JSON.parse(objsStr.split(found[0])[1])

            const logData : LogData = {
              date,
              time,
              requestId : reqId,
              logId,
              extraLogInfo,
              requestObj,
              otherObj
            }

            rowsArr.push(logData)

            requestIdMap[reqId] = true
          }

          reqId = requestId + this.getDoubleDigits(i)
        }
      }
    }

    return rowsArr
  }

  private convertToLogResult(requestId : string, arr : Array<LogData>) : LogResult {

    const requestLogData = arr.find((ld) => ld.logId === LOG_ID.REQUEST)

    if(!requestLogData) {
      throw new Error(`Request log not present for requestId ${requestId}.`)
    }

    const logResult : LogResult = {
      requestId,
      requestTs         : this.convertDateTimeToTs(requestLogData.date, requestLogData.time),
      url               : requestLogData.requestObj.url,
      requestTimeoutTs  : requestLogData.requestObj.options.timeout || DEFAULT_TIMEOUT_MS,
      requestHeaders    : requestLogData.requestObj.options.headers,
      payload           : requestLogData.requestObj.data,
      timeTakenMs       : 0,
      extraLogInfo      : requestLogData.extraLogInfo
    }

    const respLogData = arr.find((ld) => ld.logId === LOG_ID.RESPONSE)

    if(respLogData && respLogData.otherObj) {
      const responseObj = respLogData.otherObj as Response

      logResult.timeTakenMs     = responseObj.timeTakenMs
      logResult.responseTs      = this.convertDateTimeToTs(respLogData.date, respLogData.time)
      logResult.status          = responseObj.statusCode
      logResult.responseHeaders = responseObj.headers
      logResult.response        = responseObj.response
    }

    const timeoutLogData = arr.find((ld) => ld.logId === LOG_ID.TIMEOUT)

    if(timeoutLogData && timeoutLogData.otherObj) {
      const timeoutObj = timeoutLogData.otherObj as Timeout

      logResult.timeTakenMs = timeoutObj.timeTakenMs
      logResult.timedOut    = true
    }

    const errorLogData = arr.find((ld) => ld.logId === LOG_ID.ERROR)

    if(errorLogData && errorLogData.otherObj) {
      const errObj = errorLogData.otherObj as ErrorResp

      logResult.timeTakenMs = errObj.timeTakenMs
      logResult.error       = errObj.error
    }

    return logResult
  }

  private convertDateTimeToTs(date : string, time : string) : number {

    const [dd, mm, yyyy] = date.split('/'),
          dtStr          = [yyyy, mm, dd].join('-')

    return new Date(dtStr + 'T' + time).getTime()
  }

  private getDoubleDigits(no : number) : string {
    if(no < 10) return '0' + no
    return no.toString()
  }
}