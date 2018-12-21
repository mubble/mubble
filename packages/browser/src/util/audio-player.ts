/*------------------------------------------------------------------------------
   About      : Class responsible for playing audio files in the app.
   
   Created on : Sat Sep 02 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { Mubble }                     from '../../core'
import { RunContextBrowser }          from '..'

class AudioFile {

  constructor(public fileName: string, public volume ?: number) {
    this.fileName = 'sounds/' + fileName
    this.volume   = volume || .8
  }
}

export class AudioPlayer {

  readonly SELECT = new AudioFile('select.mp3', 0.4)
  
  private audioMap: Mubble.uObject<HTMLAudioElement> = {}

  constructor(private rc : RunContextBrowser) {
    this.rc.setupLogger(this, 'AudioFile')
  }

  play(file: AudioFile) {

    let control: HTMLAudioElement = this.audioMap[file.fileName] 
    if (!control) {
      control = this.audioMap[file.fileName] = new Audio(file.fileName)
      control.load()
      control.volume = file.volume
    } else {
      const isPlaying = control.currentTime > 0 && !control.paused && !control.ended && control.readyState > 2
      if (isPlaying) {
        control.pause()
        control.currentTime = 0
      }
    }

    try {
      control.play()
    } catch (err) {
      this.rc.isError() && this.rc.error(this.rc.getName(this), {fileName: file.fileName}, err)
    }
  }
}