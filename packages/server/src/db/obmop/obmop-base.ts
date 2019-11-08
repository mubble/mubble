/*------------------------------------------------------------------------------
   About      : Obmop base functions and utilities
   
   Created on : Wed Jun 19 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import { RunContextServer }         from '../../rc-server'
import { ObmopRegistryManager }     from './obmop-registry'
import { Mubble }                   from '@mubble/core'

/*------------------------------------------------------------------------------
   Obmop Decorator Functions
------------------------------------------------------------------------------*/

export namespace Obmop {

  export enum FieldType {
    PRIMARY = 1,
    MANDATORY,
    OPTIONAL
  }

  /**
   *  Annotation to mark a obmop model.
   *  Make sure the table name is same as the name of the class in lower case.
   */
  export function model() {
    return function(target : any) {
      const table = target.constructor.name.toLowerCase()

      ObmopRegistryManager.addEntity(table)
    }
  }

  /**
   *  Annotation to mark a obmop model field.
   *  Make sure the table name is same as the name of the class in lower case.
   */
  export function field(type    : FieldType = FieldType.OPTIONAL,
                        unique  : boolean   = false,
                        indexed : boolean   = false,
                        serial  : boolean   = false) {

    return function(target : any , propertyKey : string) {
      const table : string  = target.constructor.name.toLowerCase()

      ObmopRegistryManager.addField(table, propertyKey, type, unique, indexed, serial)
    }
  }

  /**
   *  Annotation to mark a obmop model primary key.
   *  Make sure the table name is same as the name of the class in lower case.
   */
  export function primaryKey(serial : boolean = false) {
    return function(target : any , propertyKey : string) {
      const table = target.constructor.name.toLowerCase()

      ObmopRegistryManager.addField(table, propertyKey, FieldType.PRIMARY, true, true, serial)
    }
  }
}

/*------------------------------------------------------------------------------
   Obmop Base Entity
------------------------------------------------------------------------------*/

/**
 *  All obmop model entities to be extended from this entity.
 *  Make sure the table name is same as the name of the class in lower case.
 */
export class ObmopBaseEntity {
  private _tableName : string

  @Obmop.field()
  public createts    : number

  @Obmop.field()
  public modts       : number

  @Obmop.field()
  public deletets    : number

  @Obmop.field()
  public deleted     : boolean = false

  constructor(rc : RunContextServer, table : string) {
    rc.isDebug() && rc.debug(rc.getName(this), 'Constructing new obmop entity.', table)

    this._tableName = table.toLowerCase()
  }

  public getTableName() {
    return this._tableName
  }
}

/*------------------------------------------------------------------------------
   Obmop Base Client
------------------------------------------------------------------------------*/

/**
 *  All obmop clients should have the following functions (implement from this interface).
 */
export interface ObmopBaseClient {

  /**
   * Used to initialize the db client. Helps the client connect with the database.
   * @param rc RunContext, used for logging.
   */
  init(rc : RunContextServer) : Promise<void>

  /**
   * Should be called after db operations are done. Helps the client close the connection with the database.
   * @param rc RunContext, used for logging.
   */
  close(rc : RunContextServer) : Promise<void>

  /**
   * Returns all the entries (rows) of the given table.
   * @param rc RunContext, used for logging.
   * @param table Table or entity name.
   */
  queryAll(rc : RunContextServer, table : string) : Promise<Array<Mubble.uObject<any>>>

  /**
   * Returns all entries (rows) of the given table for <key> <condition> <value>.
   * @param rc RunContext, used for logging.
   * @param table Table or entity name.
   * @param key Key or field name.
   * @param value Value of that field.
   * @param condition Conditional operator compatible with SQL databases. By default it is '='.
   */
  query(rc : RunContextServer, table : string, key : string, value : any,
        condition ?: string) : Promise<Array<Mubble.uObject<any>>>

  /**
   * Inserts a new entry (row) in the given table.
   * @param rc RunContext, used for logging.
   * @param table Table or entity name.
   * @param entity Entity (row) to be inserted in object form.
   */
  insert(rc : RunContextServer, table : string, entity : Mubble.uObject<any>) : Promise<void>

  /**
   * Updates all entries (rows) of the given table for <queryKey> = <queryValue>.
   * @param rc RunContext, used for logging.
   * @param table Table or entity name.
   * @param updates Updates to be applied to the entity or entities to be updated.
   * @param queryKey Key or field name for the update query.
   * @param queryValue Value of that field.
   */
  update(rc : RunContextServer, table : string, updates : Mubble.uObject<any>,
         queryKey : string, queryValue : any) : Promise<void>

  /**
   * Deletes all entries (rows) of the given table for <queryKey> = <queryValue>.
   * @param rc RunContext, used for logging.
   * @param table Table or entity name.
   * @param queryKey Key or field name for the delete query.
   * @param queryValue Value of that field.
   */
  delete(rc : RunContextServer, table : string, queryKey : string, queryValue : any) : Promise<void>
}