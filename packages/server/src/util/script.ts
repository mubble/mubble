
import * as readline from 'readline'

export function ask(msg: string): Promise<String> {
    
  return new Promise(function(resolve) {
    
    function innerAsk () {
      
      const rl = readline.createInterface({
        input  : process.stdin,
        output : process.stdout
      })
    
      rl.question(msg + ' ', function(answer) {
        
        rl.close()
        answer = answer.trim()
        if (!answer) return innerAsk()
        resolve(answer)
      })
    }
    innerAsk()
  })
}
  
