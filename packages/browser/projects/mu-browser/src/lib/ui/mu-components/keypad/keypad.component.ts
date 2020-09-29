import { Component, 
         Inject,
         Output,
         EventEmitter,
         Input
        }                         from '@angular/core'
import { RunContextBrowser } from '../../../rc-browser'

export enum KEYBOARD_MODE {
  NORMAL    = 'NORMAL',
  SHOW_DOT  = 'SHOW_DOT'
}

export enum KEY_TYPE {
  NUMBER  = 'NUMBER',
  BACK    = 'BACK',
  DONE    = 'DONE',
  DOT     = 'DOT'
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

  @Input('mode') mode : KEYBOARD_MODE
  @Output('keyPress')   keyPress  = new EventEmitter<KeyPressData>()

  KEYBOARD_MODE = KEYBOARD_MODE
  
  constructor(@Inject('RunContext') public rc : RunContextBrowser) { }

  ngOnInit() {
    if(!this.mode) this.mode = KEYBOARD_MODE.NORMAL
  }

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

  onKeyBoardDot() {
    const data : KeyPressData = { key : '.', keyType : KEY_TYPE.DOT } 
    this.keyPress.emit(data)
  }

}
