/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Thu Jan 04 2018
   Author     : Raghvendra Varma
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import {RunContextServer}    from '../rc-server'
import * as stream from "stream";
import { Buffer }  from 'buffer';

import { Mubble }  from '@mubble/core'
import { encode } from 'punycode';

export namespace UStream {

  export const Encoding = {
    bin   : 'bin',
    text  : 'text',
    json  : 'json'
  }

  export abstract class BaseStreams {

             cleaned = false
    readonly fnError = this.onError.bind(this)
             logging = false

    constructor(readonly rc: RunContextServer, readonly streams: (stream.Writable | stream.Readable) [], 
                readonly promise : Mubble.uPromise<any> = new Mubble.uPromise()) {

      const len         = streams.length,
            lastStream  = streams[len - 1],
            firstStream = streams[0]

      // Needed for Readable and PipedWriteStream
      if (this.isReadable(firstStream)) (firstStream as stream.Readable).pause()

      this.subscribe(lastStream) 
      lastStream.on('error', this.fnError)
      let prevStream = lastStream
  
      for (let i = len - 2; i >= 0; i--) {
        const stream = streams[i] as stream.Readable
        stream.on('error', this.fnError).pipe(prevStream as stream.Writable)
        prevStream = stream
      }
    }

    cleanup() {

      let lastStream, stream

      if (this.cleaned) return

      while ((stream = this.streams.shift())) {
        // had skipped removeListener to avoid process level error event
        stream.removeListener('error', this.fnError)
        if (lastStream) (lastStream as stream.Readable).unpipe(stream as stream.Writable)
        lastStream = stream
      }

      if (lastStream) { // last one, stream would be null at this point
        this.unsubscribe(lastStream)
      }
      this.cleaned = true
    }

    private onError(err: Error) {
      if (this.cleaned) return
      this.rc.isError() && this.rc.error(this.rc.getName(this), 'Error on streams', err)
      this.cleanup()
      this.promise.reject(err)
    }

    protected isReadable(stream: any) {
      return !!stream.read
    }

    protected isWritable(stream: any) {
      return !!stream.write
    }

    // Data / end / finish subscriptions on the streams
    abstract subscribe(stream: stream.Writable | stream.Readable): void
    abstract unsubscribe(stream: stream.Writable | stream.Readable): void
  }

  export class WriteStreams extends BaseStreams {

    private fnFinish: () => void

    constructor(rc: RunContextServer, streams: (stream.Writable | stream.Readable) [], 
                promise ?: Mubble.uPromise<any>) {
      super(rc, streams, promise)
    }

    public async write(data : Buffer | string) {
      const writeStream = this.streams[0] as stream.Writable
      data ? writeStream.end(data) : writeStream.end()
      await this.promise.promise
    }

    subscribe(stream: stream.Writable | stream.Readable) {
      if (!this.fnFinish) this.fnFinish = this.onFinish.bind(this)
      stream.on('finish', this.fnFinish)
    }

    unsubscribe(stream: stream.Writable | stream.Readable) {
      if (this.fnFinish) stream.removeListener('finish', this.fnFinish)
    }

    private onFinish() {
      this.cleanup()
      this.promise.resolve(null)
    }
  }

  export class ReadStreams extends BaseStreams {

    private encoding: string = Encoding.bin
    private fnEnd:  () => void
    private fnData: (chunk: Buffer | string) => void
    private body: Buffer | string

    constructor(rc: RunContextServer, streams: (stream.Writable | stream.Readable) [], 
                promise ?: Mubble.uPromise<any>) {
      super(rc, streams, promise)
    }

    public async read(encoding ?: string): Promise<Buffer | string> {
      const stream = this.streams[0] as stream.Readable
      if (encoding) this.encoding = encoding
      stream.resume()
      const result = await this.promise.promise

      this.logging && this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
        'ReadStreams: result', Buffer.isBuffer(this.body) ? 'Buffer' : 'String', result.length)

      return result
    }

    subscribe(stream: stream.Writable | stream.Readable) {

      if (!this.fnEnd) {
        this.fnEnd  = this.onEnd.bind(this)
        this.fnData = this.onData.bind(this)
      }
      stream.on('data', this.fnData).on('end', this.fnEnd)
    }

    unsubscribe(stream: stream.Writable | stream.Readable) {
      if (!this.fnEnd) return
      stream.removeListener('data', this.fnData)
      stream.removeListener('end', this.fnEnd)
    }

    onData(chunk: Buffer | string) {
      
      if (this.cleaned) return

      if (!this.body) {
        this.body = chunk
        return
      }

      if (chunk instanceof Buffer) {
        this.body = Buffer.concat([this.body as Buffer, chunk])
      } else {
        this.body += chunk
      }

      this.logging && this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
        'ReadStreams: onData', 'body', Buffer.isBuffer(this.body) ? 'Buffer' : 'String', this.body.length)
    }

    onEnd() {

      if (this.cleaned) return
      this.cleanup()

      if (this.body === undefined) {
        this.rc.isWarn() && this.rc.warn(this.rc.getName(this), 'You have tried reading an empty file')
        this.body = new Buffer('')
      }

      if (this.body instanceof Buffer) {
        if (this.encoding === Encoding.json || this.encoding === Encoding.text) {
          this.body = this.body.toString()
        }
      }

      const result = this.encoding === Encoding.json ? JSON.parse(this.body as string || '{}') : this.body

      this.logging && this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
        'ReadStreams: onEnd', 'body', Buffer.isBuffer(result) ? 'Buffer' : 'String', result.length)

      this.promise.resolve(result)
    }
  }

  export class PipedWriterStreams extends BaseStreams {

    private fnFinish: () => void

    constructor(rc: RunContextServer, streams: (stream.Writable | stream.Readable) [], 
                promise ?: Mubble.uPromise<any>) {
      super(rc, streams, promise)
      const firstStream = this.streams[0]
      rc.isAssert() && rc.assert(rc.getName(this), this.isReadable(firstStream))
    }

    public async start() {
      const firstStream = this.streams[0] as stream.Readable
      firstStream.resume()
      await this.promise.promise
    }

    subscribe(stream: stream.Writable | stream.Readable) {
      if (!this.fnFinish) this.fnFinish = this.onFinish.bind(this)
      stream.on('finish', this.fnFinish)
    }

    unsubscribe(stream: stream.Writable | stream.Readable) {
      if (this.fnFinish) stream.removeListener('finish', this.fnFinish)
    }

    private onFinish() {
      this.cleanup()
      
      this.logging && this.rc.isDebug() && this.rc.debug(this.rc.getName(this), 
        'PipedWriterStreams: onFinish')

      this.promise.resolve(null)
    }
  }
}