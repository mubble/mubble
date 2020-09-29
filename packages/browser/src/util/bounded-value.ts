export class BoundedValue {

  public  value     : number
  private elemDirUp : boolean
  private contDirUp : boolean

  private elemLow   : number
  private elemHigh  : number
  private contLow   : number
  private contHigh  : number

  constructor(initState       : number,
              finalState      : number,

              contInitState   : number,
              contFinalState  : number) {
 
    // for the element
    this.value        = initState
    this.elemDirUp    = (initState < finalState)

    this.elemLow      = this.elemDirUp ? initState : finalState
    this.elemHigh     = this.elemDirUp ? finalState : initState

    // for the controller
    this.contDirUp    = (contInitState < contFinalState)
    this.contLow      = this.contDirUp ? contInitState  : contFinalState
    this.contHigh     = this.contDirUp ? contFinalState : contInitState

  }

  compute(contValue): boolean {

    const oldValue = this.value

    if (contValue <= this.contLow) {
      this.value = this.elemDirUp ? this.elemLow : this.elemHigh
    } else if (contValue >= this.contHigh) {
      this.value = this.elemDirUp ? this.elemHigh : this.elemLow
    } else {
        
      const totalDiff = this.contHigh - this.contLow,
            thisDiff  = contValue - this.contLow,
            elemDiff  = this.elemHigh - this.elemLow 

      if (this.elemDirUp) {
        this.value = this.elemLow + elemDiff * thisDiff / totalDiff
      } else {
        this.value = this.elemHigh - elemDiff * thisDiff / totalDiff
      }
    }

    return this.value !== oldValue
  }

  getDecimalValue(digitsAfterDecimal ?: number) {
    return Number(this.value.toFixed(digitsAfterDecimal || 0))
  }

  isCloserToInit() {
    const lowDiff   = this.value - this.elemLow,
          highDiff  = this.elemHigh - this.value

    if (lowDiff < highDiff) {
      return this.elemDirUp
    } else {
      return !this.elemDirUp
    }
  }

}