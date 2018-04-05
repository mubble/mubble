/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Sun Jun 25 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.

------------------------------------------------------------------------------

- GlobalKeyValue is an automatic persistent storage system that persists the 
key, values in localStorage with keys like 'global.version'.
- A field must be annotated with @GlobalKeyValue.autoStore() for making it eligible
  for automatic storage. 

  - string default to ''
  - number defaults to 0
  - boolean defaults to false
  - object defaults to null

- A field can be given a different default value while declaring. Fields with default 
  value, are not stored in localStorage till they are changed. Once stored they
  are never deleted

- To save changes to an object, when its internal property has changed, you will
  need to CALL detectSaveChanges(), as internal changes to object are not detected
  automatically

Design
------
- autoStore.set is called before constructor for default value initialization
  
- Last persisted value of autoStore field is kept in _fieldName. The stringified 
  last persisted value is kept in _#fieldName. There is no data kept at the actual field

- ???? TODO: Write a housekeep function that will delete the unused keys

------------------------------------------------------------------------------*/
import 'reflect-metadata'
import { RunContextBrowser } from '..'

const PREFIX      = 'global',
      META_KEY    = 'autoStore',
      VALID_TYPES = [String, Number, Boolean, Object]

type fieldMapType = { [key: string]:  {
    type      : object, 
    strValue ?: string /* initial value from localStore or default */ 
  }
}

export abstract class GlobalKeyValue {

  @GlobalKeyValue.autoStore() appVersion    : string
  @GlobalKeyValue.autoStore() jsVersion     : string
  @GlobalKeyValue.autoStore() syncSegments  : object
  @GlobalKeyValue.autoStore() logLevel      : number
  
  public static autoStore(): any {

    return function(target: any, propertyKey: string) {

      // console.log('autoStore', propertyKey, target)
      Reflect.defineMetadata(META_KEY, true, target, propertyKey)

      return {

        get: function() {
          const value = this['_' + propertyKey],
                rc    = this.rc

          rc.isAssert() && rc.assert(rc.getName(this), value !== undefined, 
            `You are trying to fetch ${propertyKey}=${value} before init`)
          return value
        },

        set: function(value: any) {

          const fieldType = Reflect.getMetadata('design:type', target, propertyKey),
                rc        = this['rc']

          rc.isDebug() && rc.debug(rc.getName(this), 'autoStore.set', propertyKey, value)

          rc.isAssert() && rc.assert(rc.getName(this), value !== undefined)
          rc.isAssert() && rc.assert(rc.getName(this), VALID_TYPES.indexOf(fieldType) !== -1)

          rc.isAssert() && rc.assert(rc.getName(this), 
            value === null ? fieldType === Object : value.constructor === fieldType,
            `You are trying to set ${propertyKey}=${value} with invalid type ${typeof(value)}`)

          let strValue = fieldType === Object ? JSON.stringify(value) : String(value)

          const oldValue    = this['_' + propertyKey]

          // undefined indicates that GlobalKeyValue has not been initialized
          if (oldValue === undefined) {
            rc.isDebug() && rc.debug(rc.getName(this), 
              `Remembering default ${propertyKey}=${value}`)
            GlobalKeyValue.fieldMap[propertyKey] = {type: fieldType, strValue}
            return
          }

          const strOldValue = this['_$' + propertyKey],
                key         = PREFIX + '.' + propertyKey

          if (strOldValue === strValue) return
          
          this['_' + propertyKey]  = value
          this['_$' + propertyKey] = strValue
          this.storage.setItem(key, strValue)

          if (rc && rc.isDebug) {
            rc.isDebug() && rc.debug('GlobalKeyValue', `Saved key ${key}=${strValue}`)
          }
        }
      }
    }
  }
  
  private static fieldMap: fieldMapType = {}

  constructor(private rc: RunContextBrowser, private storage) {
  }

  init() {

    const rc = this.rc

    rc.isDebug() && rc.debug(rc.getName(this), 'GlobalKeyValue::Constructor')
    this.extractFields(this, GlobalKeyValue.fieldMap)

    for (const name of Object.keys(GlobalKeyValue.fieldMap)) {

      const field           = GlobalKeyValue.fieldMap[name],
            strSavedValue   = this.storage.getItem(PREFIX + '.' + name),
            strDefaultValue = field.strValue,
            strValue        = strSavedValue || strDefaultValue

      let value

      switch (field.type) {
        case String:
          value = strValue ? strValue : ''
          break

        case Number:
          value = strValue ? Number(strValue) : 0
          break

        case Boolean:
          value = strValue ? strValue === String(true) : false
          break

        case Object:
          value = strValue ? JSON.parse(strValue) : null
          break
      }

      this['_' + name]  = value
      this['_$' + name] = field.type === Object ? JSON.stringify(value) : String(value)
    }
    return this
  }

  // Need to be called only for fields of type object, when some internal property
  // has been changed
  public detectSaveChanges() {
    for (const name of Object.keys(GlobalKeyValue.fieldMap)) {

      const field   = GlobalKeyValue.fieldMap[name],
            type    = (field.type as any).name

      if (field.type !== Object) continue
      this[name] = this[name] // forces the set function to get called
    }
  }

  private extractFields(proto: any, fieldz: fieldMapType): void {

    if (proto === null) return

    const keys = Object.getOwnPropertyNames(proto)
    for (const key of keys) {
      if (fieldz[key]) continue
      try {
        if (Reflect.getMetadata(META_KEY, proto, key)) {
          // console.log('GlobalKeyValue:extractFields()', key)
          fieldz[key] = {type: Reflect.getMetadata('design:type', proto, key)}
        }
      } catch(err) {
        console.info('GlobalKeyValue:extractFields()', 'failed for', key)
      }
    }
    return this.extractFields(Object.getPrototypeOf(proto), fieldz)
  }

  $dump() {

    for (const name of Object.keys(GlobalKeyValue.fieldMap)) {

      const field   = GlobalKeyValue.fieldMap[name],
            type    = (field.type as any).name,
            memory  = this[name],
            store   = this.storage.getItem(PREFIX + '.' + name)

      console.info({name, type, memory, store})
    }
  }

}