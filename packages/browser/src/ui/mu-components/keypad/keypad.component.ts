import { Component, 
         Inject,
         Output,
         EventEmitter
        }                         from '@angular/core'
import { RunContextApp }          from 'framework'

export enum KEY_TYPE {
  NUMBER  = 'NUMBER',
  BACK    = 'BACK',
  DONE    = 'DONE'
}

export interface KeyPressData {
  keyType : KEY_TYPE
  key     : string
}

@Component({
  selector    : 'keypad',
  templateUrl : './keypad.component.html',
  styleUrls   : ['./keypad.component.scss']
})
export class KeypadComponent {

  @Output('keyPress')   keyPress  = new EventEmitter<KeyPressData>()
  
  constructor(@Inject('RunContext') public rc : RunContextApp) { }

  keyClick(inputNum: string) {
    const data : KeyPressData = { key : inputNum, keyType : KEY_TYPE.NUMBER } 
    this.keyPress.emit(data)
  }

  onKeyBoardBack() {
    const data : KeyPressData = { key : null, keyType : KEY_TYPE.BACK } 
    this.keyPress.emit(data)
  }

  onKeyBoardOk() {
    const data : KeyPressData = { key : null, keyType : KEY_TYPE.DONE } 
    this.keyPress.emit(data)
  }

}
