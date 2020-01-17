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
  export function field(type      : FieldType = FieldType.OPTIONAL,
                        unique    : boolean   = false,
                        indexed   : boolean   = false,
                        serial    : boolean   = false,
                        sequence ?: string) {

    return function(target : any , propertyKey : string) {
      const table : string  = target.constructor.name.toLowerCase()

      ObmopRegistryManager.addField(table, propertyKey, type, unique, indexed, serial, sequence)
    }
  }

  /**
   *  Annotation to mark a obmop model primary key.
   *  Make sure the table name is same as the name of the class in lower case.
   */
  export function primaryKey(serial : boolean = false, sequence ?: string) {
    return function(target : any , propertyKey : string) {
      const table = target.constructor.name.toLowerCase()

      ObmopRegistryManager.addField(table, propertyKey, FieldType.PRIMARY, true,
                                    true, serial, sequence)
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
 *  Retval to all query functions of an Obmop Client.
 */
export type QueryRetval = {
  entities   : Array<Mubble.uObject<any>>
  totalCount : number
}

/**
 *  Optional query range.
 */
export type QueryRange = {
  key  : string
  low  : any
  high : any
}

/**
 * Optional query sorting
 */
export type QuerySort = {
  key   : string
  order : string
}

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
   * @param limit Defines the number of results to be fetched.
   * @param offset The offset to start fetching the values from. 
   * @param range Optional range for query retval.
   * @param sort Optional sort for query retval.
   */
  queryAll(rc : RunContextServer, table : string, fields : Array<string>, 
           limit ?: number, offset ?: number, range ?: QueryRange, 
           sort ?: QuerySort) : Promise<QueryRetval>

  /**
   * Returns all entries (rows) of the given table for <key> <operator> <value>.
   * @param rc RunContext, used for logging.
   * @param table Table or entity name.
   * @param key Key or field name.
   * @param value Value of that field.
   * @param operator Conditional operator compatible with SQL databases. By default it is '='.
   * @param limit Defines the number of results to be fetched.
   * @param offset The offset to start fetching the values from.
   * @param range Optional range for query retval.
   * @param sort Optional sort for query retval.
   */
  query(rc : RunContextServer, table : string, fields : Array<string>, key : string,
        value : any, operator ?: string, limit ?: number, offset ?: number,
        range ?: QueryRange, sort ?: QuerySort) : Promise<QueryRetval>

  /**
   * Returns all entries (rows) of the given table for multiple <key> <operator> <value> seperated by AND.
   * @param rc RunContext, used for logging.
   * @param table Table or entity name.
   * @param conditions Given multiple conditions.
   * @param limit Defines the number of results to be fetched.
   * @param offset The offset to start fetching the values from.
   * @param range Optional range for query retval.
   * @param sort Optional sort for query retval.
   */
  queryAnd(rc : RunContextServer, table : string, fields : Array<string>,
           conditions : Array<{key : string, value : any, operator ?: string}>,
           limit ?: number, offset ?: number, range ?: QueryRange,
           sort ?: QuerySort) : Promise<QueryRetval>

  /**
   * Returns all entries (rows) of the given table for multiple <value> using IN.
   * @param rc RunContext, used for logging.
   * @param table Table or entity name.
   * @param key Key or field name.
   * @param values Array of values of that field.
   * @param limit Defines the number of results to be fetched.
   * @param offset The offset to start fetching the values from.
   * @param range Optional range for query retval.
   * @param sort Optional sort for query retval
   */      
  queryIn(rc : RunContextServer, table : string, fields : Array<string>, key : string, 
          values :  Array<any>, limit ?: number, offset ?: number,
          range ?: QueryRange, sort ?: QuerySort): Promise<QueryRetval>          
               
  /**
   * Inserts a new entry (row) in the given table.
   * @param rc RunContext, used for logging.
   * @param table Table or entity name.
   * @param entity Entity (row) to be inserted in object form.
   * @param sequences Object containing the information of sequenced fields.
   */
  insert(rc : RunContextServer, table : string, entity : Mubble.uObject<any>,
         sequences ?: Mubble.uObject<string>) : Promise<void>

  /**
   * Inserts multiple entries (rows) in the given table.
   * @param rc RunContext, used for logging.
   * @param table Table or entity name.
   * @param entities Entities (rows) to be inserted in object form.
   * @param sequences Object containing the information of sequenced fields.
   */
  mInsert?(rc : RunContextServer, table : string, entities : Array<Mubble.uObject<any>>,
           sequences ?: Mubble.uObject<string>) : Promise<void>

  /**
   * Updates all entries (rows) of the given table for <queryKey> = <queryValue>.
   * @param rc RunContext, used for logging.
   * @param table Table or entity name.
   * @param updates Updates to be applied to the entity or entities to be updated.
   * @param queryKey Key or field name for the update query.
   * @param queryValue Value of that field.
   * @param sequences Object containing the information of sequenced fields.
   */
  update(rc : RunContextServer, table : string, updates : Mubble.uObject<any>,
         queryKey : string, queryValue : any, sequences ?: Mubble.uObject<string>) : Promise<void>

  /**
   * Deletes all entries (rows) of the given table for <queryKey> = <queryValue>.
   * @param rc RunContext, used for logging.
   * @param table Table or entity name.
   * @param queryKey Key or field name for the delete query.
   * @param queryValue Value of that field.
   */
  delete(rc : RunContextServer, table : string, queryKey : string, queryValue : any) : Promise<void>
}