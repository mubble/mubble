/*------------------------------------------------------------------------------
   About      : Performance measurement for multi-step tasks
   
   Created on : Thu Jul 27 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { format } from './date'
import { Mubble } from '../mubble'  

import * as lo from 'lodash'

const CYCLE_STEP = '_cycle_'

export class PerformanceMetrics {

  private startTs: number

  private cycles: Cycle[] = []
  private cycle: Cycle

  constructor(private taskName: string) {
    this.startTs = this.now()
  }

  public startStep(stepName: string) {

    const now = this.now()

    if (!this.cycle || this.cycle.stepMap[stepName]) {

      if (this.cycle) {
        this.cycle.endTs = now
        this.cycles.push(this.cycle)
      }

      this.cycle = new Cycle(this.cycles.length, now, stepName)

    } else {
      this.cycle.stepMap[stepName] = new Step(now)
    }
  }

  public endStep(stepName: string) {

    const step = this.cycle.stepMap[stepName]

    if (!step) {
      console.error(stepName, 'ended without start for', this.taskName)
      return
    }

    step.endTs = this.now()
  }

  public finish() {

    const now     = this.now(),
          output  = {
            task        : this.taskName, 
            totalMs     : now - this.startTs,
            cycleCount  : this.cycles.length,
            cyclePerf   : new ResultEntry(),
            stepPerf    : {} as Mubble.uObject<ResultEntry>
          }

    if (this.cycle) {
      this.cycle.endTs = now
      this.cycles.push(this.cycle)
    }

    for (let index = 0; index < this.cycles.length; index++) {
      
      const cycle = this.cycles[index]
      output.cyclePerf = this.markEntry(cycle.endTs - cycle.startTs, index, output.cyclePerf)

      for (const stepName in cycle.stepMap) {
        const step = cycle.stepMap[stepName],
              perf = output.stepPerf[stepName]

        if (!step.endTs) {
          console.error('You forgot to call endStep for ' + stepName + ' for cycle index:' + index)
          continue
        }
        output.stepPerf[stepName] = this.markEntry(step.endTs - step.startTs, index, perf)
      }
    }
    
    console.info('Result summary ', output)
    
    let marks: Cycle[]  = []
    this.logEntry('all cycles', output.cyclePerf, marks)

    for (const stepName in output.stepPerf) {
      this.logEntry(stepName, output.stepPerf[stepName], marks)
    }
    
    marks = lo.sortBy(marks, 'startTs')
    console.info('Highlighted cycles (having min/max cycle/step time) >>')
    for (const mark of marks) {
      console.info(mark.toString())
    }
    console.info('all cycles to deep dive >>', this.cycles)
  }

  private markEntry(ts: number, index: number, entry: ResultEntry): ResultEntry {

    entry = entry || new ResultEntry()

    if (entry.min > ts) {
      entry.min     = ts
      entry.minIdx  = index
    }
    
    if (entry.count && entry.max < ts) {
      entry.max     = ts
      entry.maxIdx  = index
    }

    entry.total += ts 
    entry.count++

    return entry
  }

  private now() {
    return performance ? performance.timing.navigationStart + performance.now() : Date.now()
  }

  private logEntry(name: string, entry: ResultEntry, insertInto: Cycle[]) {

    console.info(name + ' performance >> ' + entry)

    if (entry.minIdx !== -1) {
      const cycle = this.cycles[entry.minIdx]
      if (insertInto.indexOf(cycle) === -1) insertInto.push(cycle)
    }

    if (entry.maxIdx !== -1) {
      const cycle = this.cycles[entry.maxIdx]
      if (insertInto.indexOf(cycle) === -1) insertInto.push(cycle)
    }

  }

}

class BaseTime {

  startTs : number
  endTs   : number

  constructor(startTs: number) {
    this.startTs = startTs
  }
}

class Step extends BaseTime {

}

class Cycle extends BaseTime {
  index    : number
  stepMap  : Mubble.uObject<Step>

  constructor(index: number, now: number, step: string) {
    super(now)
    this.index = index
    this.stepMap = {[step]: new Step(now)}
  }

  toString() {
    const ts = this.endTs - this.startTs
    return `Cycle(${this.index}) @ ${format(this.startTs, '%hh%:%mm%:%ss% %ms%')} timeTaken: ${ts.toFixed(3)}ms`
  }
}

class ResultEntry {

  count   : number = 0
  min     : number =  Number.MAX_SAFE_INTEGER
  max     : number = -1
  total   : number = 0
  minIdx  : number = -1
  maxIdx  : number = -1

  toString() {

    const average = this.count ? this.total / this.count : 0
    return `minMs: ${this.min.toFixed(3)
      } ${this.max !== -1 ? 'maxMs: ' + this.max.toFixed(3) : ''
      } avgMs: ${average.toFixed(3)} count: ${this.count
      } ${this.minIdx !== -1 ? 'minIdx: ' + this.minIdx : ''
      } ${this.maxIdx !== -1 ? 'maxIdx: ' + this.maxIdx : ''}`
  }
}

