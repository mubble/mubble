export class MultiStepValue {

  public currentIndex : number = 0
  public currentValue : number = 0

  private maxVal      : number
  private tolerance   : number = 0

  constructor(private minVal    : number, 
              private viewSize  : number, 
              private count     : number ,
              private applyTol  ?: boolean,
              private quickMove ?: boolean) {

    this.maxVal   = minVal + viewSize * ( count - 1 ) // -1 is done so that last item is displayed in view
    if (applyTol) this.tolerance = viewSize * .25
  }

  transition(delta: number): number {
    
    const newValue = this.currentValue - delta

      if (newValue < this.minVal - this.tolerance) return this.minVal - this.tolerance
      if (newValue > this.maxVal + this.tolerance) return this.maxVal + this.tolerance

    return newValue
  }

  final(delta: number, speed: number, quickRatio ?: number): void {
   
    const newValue    = this.transition(delta),
          chgNeeded   = (speed >= .2 ? .1 : .25) * this.viewSize,
          lowerBound  = this.currentIndex * this.viewSize + this.minVal

    let newIndex
    

    if (delta > 0) { // trying to reduce index

      if (this.quickMove) {
        newIndex = (quickRatio && quickRatio > 0) ? Math.round(quickRatio * this.count) : Math.round((lowerBound- newValue)/this.viewSize)
      }
      
      if ((lowerBound  - newValue) >= chgNeeded) {

        this.currentIndex -= this.quickMove ? newIndex : Math.abs(Math.round((lowerBound  - newValue)/this.viewSize))

        if (this.currentIndex < 0) {
          this.currentIndex = 0
        }
        this.currentValue = this.currentIndex * this.viewSize + this.minVal
      }

    } else {
      if (this.quickMove) {
        newIndex = (quickRatio && quickRatio > 0) ? Math.round(quickRatio * this.count) : Math.round((newValue - lowerBound)/this.viewSize)
      }
      if ((newValue - lowerBound) >= chgNeeded) {
        
        this.currentIndex += this.quickMove ? newIndex : Math.round((newValue - lowerBound)/this.viewSize)
        if (this.currentIndex >= this.count) {
          this.currentIndex = this.count - 1
        }
        this.currentValue = this.currentIndex  * this.viewSize + this.minVal
      } 
    }
  }

}