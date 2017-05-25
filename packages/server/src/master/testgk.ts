import {RedisClient , createClient , ResCallbackT} from 'redis'


export type gk = '' | '34' | 34

export class TestGK {

  private redis : RedisClient 

  testSomeThing() : void {

    this.doSomeThing('' , '34' , 45)
    this.test123('123' , ...['abcd' , '23' , '45' ] , 'ddddd')
    this.test124(['abcd' , '23' , '45' ])
  }

  doSomeThing(val : string , val2 : gk ,  num : number | boolean | undefined , num2? : number ) : string {

      this.redis.info([])
      return ''
  }

  test123(...gk : string[]) : void {

  }

  test124(gk : string[]) : void {

  }


}

let func : ResCallbackT<string>

func = function(err : Error , name : string) : boolean {

  return false
}

func = (err : Error , name : string) =>  {
  return false
}

let nf : (name : string , val1 : number , val2 : number) => boolean = function (a , b , c) {
  
  return a.indexOf('') > (b+c)
}

export const gk1 = {abc : 5 }