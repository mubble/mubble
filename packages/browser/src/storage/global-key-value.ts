/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Sun Jun 25 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/
import 'reflect-metadata'
import { RunContextBrowser } from '..'

const PREFIX      = 'global',
      META_KEY    = 'autoStore'

export abstract class GlobalKeyValue {

  @GlobalKeyValue.autoStore() appVersion    : string
  @GlobalKeyValue.autoStore() jsVersion     : string
  @GlobalKeyValue.autoStore() syncSegments  : object

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

          // console.log('autoStore:setter', fieldType, this['_' + propertyKey], value)

          const fieldType = Reflect.getMetadata('design:type', target, propertyKey),
                oldValue  = this['_' + propertyKey],
                rc        = this['rc'],
                key       = PREFIX + '.' + propertyKey

          if ((value !== null && value.constructor !== fieldType) || 
              (value === null) && fieldType !== Object) {
            throw(new Error(`You are trying to set ${propertyKey}=${value} with invalid type ${typeof(value)}`))
          }

          this['_' + propertyKey] = value

          // undefined indicates that value is being set in the constructor
          if (oldValue === undefined) return

          let strValue: string,
              strOldValue: string

          switch (fieldType) {
            case String:
            case Number:
            case Boolean:
              strValue    = String(value)
              strOldValue = String(oldValue)
              break

            case Object:

              strValue    = JSON.stringify(value)
              strOldValue = JSON.stringify(oldValue)
              break
            
            default:
              console.log('autoStore:setter', 'unknown field type', fieldType)
              throw(new Error('autoStore:setter - unknown field type' + fieldType))
          }
          
          // no change in the value
          if (strOldValue === strValue) return

          localStorage.setItem(key, strValue)
          if (rc && rc.isDebug) {
            rc.isDebug() && rc.debug('GlobalKeyValue', `Saved key ${key}=${strValue}`)
          }
        }
      }
    }
  }
  
  private autoFields: {name: string, type: object}[] = []

  constructor(private rc: RunContextBrowser) {

    this.autoFields = []
    this.extractFields(this, this.autoFields)

    for (const autoField of this.autoFields) {

      const name      = autoField.name,
            strValue  = localStorage.getItem(PREFIX + '.' + name)

      let value

      switch (autoField.type) {
        case String:
          value = strValue || ''
          break

        case Number:
          value = Number(strValue) || 0
          break

        case Boolean:
          value = strValue === String(true)
          break

        case Object:
          value = strValue === 'null' ? null : JSON.parse(strValue)  
          break
      }

      this[name] = value
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

  $dump() {

    for (const autoField of this.autoFields) {

      const name    = autoField.name,
            type    = (autoField.type as any).name,
            memory  = this[name],
            store   = localStorage.getItem(PREFIX + '.' + name)

      console.log({name, type, memory, store})
    }
  }

}