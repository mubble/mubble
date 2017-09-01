/*------------------------------------------------------------------------------
   About      : Performance measurement for multi-step tasks
   
   Created on : Thu Jul 27 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import {  RunContextBase, 
          format,
          Mubble 
} from '..'  
import * as lo from 'lodash'

const CYCLE_STEP = '_cycle_'

export class PerformanceMetrics {

  private startTs: number

  private cycles: Cycle[] = []
  private cycle: Cycle

  constructor(private rc: RunContextBase, private taskName: string) {
    this.startTs = this.now()
  }

  public startStep(stepName: string) {

    const now = this.now()

    if (!this.cycle || this.cycle.stepMap[stepName]) {

      if (this.cycle) {
        this.cycle.ts = now - this.cycle.startTs
        this.cycles.push(this.cycle)
      }

      this.cycle = new Cycle(this.cycles.length, now, stepName)

    } else {
      this.cycle.stepMap[stepName] = now
    }
  }

  public endStep(stepName: string) {
    const startTs = this.cycle.stepMap[stepName]

    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), startTs, 
        stepName, 'ended without start for', this.taskName)

    this.cycle.stepMap[stepName] = this.now() - startTs
  }

  public finish() {

    const now = this.now(),
          output = {
            task    : this.taskName, 
            totalMs : now - this.startTs,
            steps : {} as Mubble.uObject<Entry>
          }

    if (this.cycle) {
      this.cycle.ts = now - this.cycle.startTs
      this.cycles.push(this.cycle)
    }

    for (let index = 0; index < this.cycles.length; index++) {
      
      const cycle = this.cycles[index]
      output.steps[CYCLE_STEP] = this.markEntry(cycle.ts, index, output.steps[CYCLE_STEP])

      for (const stepName in cycle.stepMap) {
        const entry = output.steps[stepName]
        output.steps[stepName] = this.markEntry(cycle.stepMap[stepName], index, entry)
      }
    }

    console.info(output)

    let marks = []
    for (const stepName in output.steps) {

      let entry = output.steps[stepName], cycle
      entry.avg = entry.avg / entry.count

      console.info(stepName, entry.toString())

      if (entry.minIdx !== -1) {
        const cycle = this.cycles[entry.minIdx]
        if (marks.indexOf(cycle) === -1) marks.push(cycle)
      }

      if (entry.maxIdx !== -1) {
        const cycle = this.cycles[entry.maxIdx]
        if (marks.indexOf(cycle) === -1) marks.push(cycle)
      }
    }

    marks = lo.sortBy(marks, 'startTs')
    console.info(marks)
    for (const mark of marks) {
      console.info(mark.toString())
    }
    console.info(this.cycles)
  }

  private markEntry(ts: number, index: number, entry: Entry) {

    entry = entry || new Entry()

    if (entry.min > ts) {
      entry.min     = ts
      entry.minIdx  = index
    } 
    
    if (entry.count && entry.max < ts) {
      entry.max     = ts
      entry.maxIdx  = index
    }

    entry.avg += ts // it is averaged at the end
    entry.count++

    return entry
  }

  private now() {
    return performance ? performance.timing.navigationStart + performance.now() : Date.now()
  }
}

class Cycle {
  index    : number
  startTs  : number
  stepMap  : Mubble.uObject<number>
  ts       : number

  constructor(index: number, now: number, step: string) {
    this.startTs  = now 
    this.index = index
    this.stepMap = {[step]: now}
  }

  toString() {
    return `Cycle(${this.index}) @ ${format(this.startTs, '%hh%:%mm%:%ss%')} timeTaken: ${this.ts.toFixed(3)}ms`
  }
}

class Entry {

  count   : number = 0
  min     : number =  Number.MAX_SAFE_INTEGER
  max     : number = -1
  avg     : number = 0
  minIdx  : number = -1
  maxIdx  : number = -1

  toString() {
    return `min: ${this.min.toFixed(3)
      } ${this.max !== -1 ? 'max: ' + this.max.toFixed(3) : ''
      } avg: ${this.avg.toFixed(3)} count: ${this.count
      } ${this.minIdx !== -1 ? 'minIdx: ' + this.minIdx : ''
      } ${this.maxIdx !== -1 ? 'maxIdx: ' + this.maxIdx : ''}`
  }
}

