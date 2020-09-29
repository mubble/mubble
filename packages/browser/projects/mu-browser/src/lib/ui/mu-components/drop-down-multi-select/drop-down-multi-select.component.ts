import { Component, 
         Inject, 
         Input,
         Output,
         EventEmitter,
         HostListener,
         ChangeDetectorRef
       }                            from '@angular/core'
import { RunContextBrowser }        from '../../../rc-browser'
import { SelectionBoxParams }       from '@mubble/core'
import { MatCheckboxChange }        from '@angular/material/checkbox'

@Component({
  selector    : 'drop-down-multi-select',
  templateUrl : './drop-down-multi-select.component.html',
  styleUrls   : ['./drop-down-multi-select.component.scss']
})

export class DropDownMultiSelectComponent {

  showDropDown    : boolean
  isDropDownOpen  : boolean   = false
  isSelectAll     : boolean   = false
  showPlaceHolder : boolean   = true
  listOptions     : SelectionBoxParams[] = []

  @Input() options        : SelectionBoxParams[]
  @Input() showSelectAll  : boolean
  @Input() placeholder    : string
  @Output() selectedItems : EventEmitter<SelectionBoxParams>  = new EventEmitter<SelectionBoxParams>()
  @Output() selectedAll   : EventEmitter<MatCheckboxChange>   = new EventEmitter<MatCheckboxChange>()

  constructor(@Inject('RunContext') protected rc  : RunContextBrowser,
    private changeRef                             : ChangeDetectorRef) { }

  ngOnInit() {
    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), this.options, `missing options ${this.options}`)
    this.listOptions = JSON.parse(JSON.stringify(this.options))
  }

  /*=====================================================================
                              UTILS
  =====================================================================*/

    @HostListener('document:click', ['$event']) 
    onHostClick(element : any) {      
      const calExpStr = ['drop-down-list', 'checkbox-cont']
      let isMatched : boolean = false

      if (this.showDropDown) {
        for (let exp of calExpStr) {
          const calExp = new RegExp(exp)
          isMatched = calExp.test(element.target.offsetParent.className)
          if (isMatched) return
        }
        if (!this.isDropDownOpen) {
          this.showDropDown   = false
        } else {
          this.isDropDownOpen = false
        }
      } 
    }

  /*=====================================================================
                              PRIVATE
  =====================================================================*/

  private handlePlaceHolder() {

    const index : number = this.listOptions.findIndex((option) => {
      return option.selected
    })

    if (index !== -1) this.showPlaceHolder = false
    else this.showPlaceHolder = true
  }

  /*=====================================================================
                              HTML
  =====================================================================*/

  handleDropDown() {
    this.showDropDown   = !this.showDropDown
    this.isDropDownOpen = !this.isDropDownOpen
  }

  onCheckBoxClick(event : MatCheckboxChange, option : SelectionBoxParams) {
    if (event.checked) {
      option.selected       = true
      this.showPlaceHolder  = false
    } else {
      option.selected = false
      this.handlePlaceHolder()
    }

    this.changeRef.detectChanges()

    this.selectedItems.emit(option)
  }

  onSelectAll(event : MatCheckboxChange) {

    if (event.checked) {
      this.showPlaceHolder = false
      this.listOptions.forEach((option) => {
        option.selected = true
      })
      this.isSelectAll = true
    } else {
      this.listOptions.forEach((option) => {
        option.selected = false
      })
      this.isSelectAll = false
      this.handlePlaceHolder()
    }

    this.selectedAll.emit(event)
  }
}