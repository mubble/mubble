

// dummy for now
var ma:any


@ma.config({
  
  dependencies: []

})
class OperatorCircle extends MasterBase {

  @ma.key 
    operator : string
  @ma.key 
    circle   : string 

  @ma.optional 
    localMobiles: string[]
  @ma.optional 
    localFixedLines: string[]

    supported: boolean

  @ma.keyIn('x', 'y', 'z') 
    info: Object


}