/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Sun Jun 25 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import 'reflect-metadata'

const BOOL_TRUE   = 'true',
      BOOL_FALSE  = 'false',
      PREFIX      = 'global',
      META_KEY    = 'autoStore'

export abstract class GlobalKeyValue {

  public static autoStore(): any {

    return function(target: any, propertyKey: string) {

      // console.log('autoStore', propertyKey, target)
      Reflect.defineMetadata(META_KEY, true, target, propertyKey)

      return {

        get: function() {
          const value = this['_' + propertyKey]
          // console.log('autoStore:getter', propertyKey, Reflect.getMetadata('design:type', target, propertyKey), value)
          return value
        },

        set: function(value: any) {

          const fieldType = Reflect.getMetadata('design:type', target, propertyKey)

          // console.log('autoStore:setter', fieldType, this['_' + propertyKey], value)

          this['_' + propertyKey] = value
          let convertedValue: string

          switch (fieldType) {
            case String:
            case Number:
              convertedValue = value
              break

            case Boolean:
              convertedValue = value === true ? BOOL_TRUE : BOOL_FALSE
              break

            case Object:
              convertedValue = JSON.stringify(value)  
              break
            
            default:
              console.log('autoStore:setter', 'unknown field type', fieldType)
              throw(new Error('autoStore:setter - unknown field type' + fieldType))
          }
          localStorage.setItem(PREFIX + '.' + propertyKey, convertedValue)
        }
      }
    }
  }

  @GlobalKeyValue.autoStore() appVersion : string
  @GlobalKeyValue.autoStore() jsVersion  : string
  private autoFields: {name: string, type: object}[] = []

  constructor() {

    this.autoFields = []
    this.extractFields(this, this.autoFields)

    for (const autoField of this.autoFields) {

      const name      = autoField.name,
            strValue  = localStorage.getItem(PREFIX + '.' + name)

      let convertedValue

      switch (autoField.type) {
        case String:
          convertedValue = strValue || ''
          break

        case Number:
          convertedValue = Number(strValue) || 0
          break

        case Boolean:
          convertedValue = strValue === BOOL_TRUE
          break

        case Object:
          convertedValue = JSON.parse(strValue || null)  
          break
      }

      this[name] = convertedValue
    }
  }

  private extractFields(proto: any, fields: any[]): void {

    if (proto === null) return

    const keys = Object.getOwnPropertyNames(proto)
    for (const key of keys) {
      try {
        if (Reflect.getMetadata(META_KEY, proto, key)) {
          // console.log('GlobalKeyValue:extractFields()', key)
          fields.push({name: key, type: Reflect.getMetadata('design:type', proto, key)})
        }
      } catch(err) {
        console.log('GlobalKeyValue:extractFields()', 'failed for', key)
      }
    }
    return this.extractFields(Object.getPrototypeOf(proto), fields)
  }

  dump() {

    for (const autoField of this.autoFields) {

      const name    = autoField.name,
            type    = (autoField.type as any).name,
            memory  = this[name],
            store   = localStorage.getItem(PREFIX + '.' + name)

      console.log({name, type, memory, store})
    }
  }

}