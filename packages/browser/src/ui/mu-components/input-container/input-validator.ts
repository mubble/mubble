import { AbstractControl,
         FormControl
       }                        from '@angular/forms'

export class InputValidator {

  static dateValidator(control : AbstractControl) {
    const startDateTS = control.get('startDate').value ? control.get('startDate').value.toDate().getTime() : null,
          endDateTS   = control.get('endDate').value   ? control.get('endDate').value.toDate().getTime()   : null,
          dateNowTS   = Date.now()

    if (!startDateTS && endDateTS) {
      control.get('startDate').setErrors({ noStartDate : true })
    } else if (endDateTS && (dateNowTS - endDateTS) < 0) {
      control.get('endDate').setErrors({ futureDate : true })
    } else if (startDateTS && (dateNowTS - startDateTS) < 0) {
      control.get('startDate').setErrors({ futureDate : true })
    } else if (endDateTS && startDateTS && (endDateTS - startDateTS < 0)) {
      control.get('startDate').setErrors({ startDateExceed: true })
    } else {
      return null
    }
  }

  static amountValidator(control : AbstractControl) {
    const minAmount = control.get('minAmount').value ? control.get('minAmount').value : null,
          maxAmount = control.get('maxAmount').value ? control.get('maxAmount').value : null

    if (!minAmount && maxAmount) {
      control.get('minAmount').setErrors({ noMinAmount : true })
    } else if (maxAmount && minAmount && (maxAmount - minAmount < 0)) {
      control.get('minAmount').setErrors({ minAmountExceed : true })
    } else {
      return null
    }
  }

  static futureDateValidator(control : FormControl) {

    if (!control.value) return null

    const dateNowTS = Date.now(),
          date      = control.value.toDate().getTime()

    if (dateNowTS - date < 0) {
      control.setErrors({ futureDate : true })
    } else {
      return null
    }
  }
}