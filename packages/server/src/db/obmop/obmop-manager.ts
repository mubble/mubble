/*------------------------------------------------------------------------------
   About      : Obmop Manager
   
   Created on : Fri Jun 14 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import { 
				 DB_ERROR_CODE,
				 ObmopErrorMessage
			 } 														from './obmop-util'
import {
				 ObmopBaseEntity,
				 ObmopBaseClient,
				 QueryRange,
				 QuerySort
			 } 														from './obmop-base'
import { ObmopRegistryManager, 
				 ObmopFieldInfo 
			 } 														from './obmop-registry'
import { RunContextServer }   			from '../../rc-server'
import { Mubble } 								 	from '@mubble/core'
import * as lo 											from 'lodash'

export type ObmopQueryRetval<T> = {
	entities   : Array<T>
	totalCount : number
}

export type ObmopCondition<T> = {
	key 			: keyof T
	value 		: any
	operator ?: string
	upper    ?: boolean
}

export type ObmopRange<T> = {
	key  : keyof T
	low  : any
	high : any
}

export type ObmopSort<T> = {
	key   : keyof T
	order : string
}

export class ObmopManager {

  constructor(rc : RunContextServer, private client : ObmopBaseClient) {
    rc.isDebug() && rc.debug(rc.getName(this), 'Constructing new obmop manager.', client)
	}
	
	public async init(rc : RunContextServer) {
		rc.isDebug() && rc.debug(rc.getName(this), 'Initializing ObmopManager.')

		await this.client.init(rc)
	}

  public async close(rc : RunContextServer) {
    await this.client.close(rc)
  }

	/**
   *  Function to get all rows for an obmop entity.
   */
  public async queryAll<T extends ObmopBaseEntity>(rc         : RunContextServer,
																									 entityType : new(rc : RunContextServer) => T,
																									 limit			: number = -1,
																									 offset 		: number = 0,
																									 range     ?: ObmopRange<T>,
																									 sort      ?: ObmopSort<T>) : Promise<ObmopQueryRetval<T>> {

		const tableName = new entityType(rc).getTableName(),
					fields    = ObmopRegistryManager.getRegistry(tableName).getFieldNames()

		rc.isDebug() && rc.debug(rc.getName(this), 'Fetching all data.', tableName)

		try {
			const records = await this.client.queryAll(rc, tableName, fields, limit, offset, 
																								 range as QueryRange, sort as QuerySort)


			const entities = records.entities.map((record) => {
				const entity = new entityType(rc)
	
				Object.assign(entity, record)
				return entity
			})
	
			const result : ObmopQueryRetval<T> = {
				entities,
				totalCount : records.totalCount
			}
	
			return result

		}	catch(err) {
			const mErr = new Mubble.uError(DB_ERROR_CODE, `Error in querying ${tableName}.`)
			rc.isError() && rc.error(rc.getName(this), mErr, err)
			throw mErr
		}
  }

	/**
   *  Function to get rows for an obmop entity with a specific query.
	 * 	By default the condition is equals (=).
   */
  public async query<T extends ObmopBaseEntity>(rc         : RunContextServer,
              			 														entityType : new(rc : RunContextServer) => T,
              			 														key        : keyof T,
              			 														value      : any,
																								operator   : string = '=',
																								limit 		 : number = -1,
																								offset		 : number = 0,
																								range     ?: ObmopRange<T>,
																								sort      ?: ObmopSort<T>) : Promise<ObmopQueryRetval<T>> {

		const tableName = new entityType(rc).getTableName(),
					fields    = ObmopRegistryManager.getRegistry(tableName).getFieldNames()

		// TODO : Add checks to query only on indexed fields

		rc.isDebug() && rc.debug(rc.getName(this), 'Fetching data.', tableName, key, operator, 
														 value, range, sort)

		try {
			const records = await this.client.query(rc, tableName, fields, key as string, value,
																							operator, limit, offset, range as QueryRange,
																						  sort as QuerySort)


			const entities = records.entities.map((record) => {
				const entity = new entityType(rc)
	
				Object.assign(entity, record)
				return entity
			})
	
			const result : ObmopQueryRetval<T> = {
				entities,
				totalCount : records.totalCount
			}
	
			return result
		}	catch(err) {
			const mErr = new Mubble.uError(DB_ERROR_CODE, `Error in querying ${tableName}.`)
			rc.isError() && rc.error(rc.getName(this), mErr, err)
			throw mErr
		}
	}
	
	/**
   *  Function to get rows for an obmop entity with multiple AND queries.
	 * 	By default the condition is equals (=).
   */
	public async queryAnd<T extends ObmopBaseEntity>(
														rc 				 : RunContextServer,
														entityType : new(rc : RunContextServer) => T,
														conditions : Array<ObmopCondition<T>>,
														limit			 : number = -1,
														offset		 : number = 0,
														range			?: ObmopRange<T>,
														sort      ?: ObmopSort<T>) : Promise<ObmopQueryRetval<T>> {

		const tableName 			 = new entityType(rc).getTableName(),
					fields    			 = ObmopRegistryManager.getRegistry(tableName).getFieldNames(),
					clientConditions = conditions.map((cond) => {
															 if(cond.upper) {
																 return {
																	 key 			: `UPPER(${cond.key})`,
																	 value 		: cond.value,
																	 operator : cond.operator
																 }
															 }

															 return {
																				 key	 		: cond.key as string,
																				 value 		: cond.value,
																				 operator : cond.operator
																			}
														 })

		// TODO : Add checks to query only on indexed fields

		rc.isDebug() && rc.debug(rc.getName(this), 'Fetching data.', tableName, conditions, range, sort)

		try {
			const records = await this.client.queryAnd(rc, tableName, fields, clientConditions,
																								 limit, offset, range as QueryRange,
																								 sort as QuerySort)

			const result : ObmopQueryRetval<T> = {
				entities   : records.entities.map((record) => {
																												const entity = new entityType(rc)
																								
																												Object.assign(entity, record)
																												return entity
																											}),
				totalCount : records.totalCount
			}
	
			return result

		}	catch(err) {
			const mErr = new Mubble.uError(DB_ERROR_CODE, `Error in querying ${tableName}.`)
			rc.isError() && rc.error(rc.getName(this), mErr, err)
			throw mErr
		}
	}

	public async queryIn<T extends ObmopBaseEntity>(
													 rc 				: RunContextServer,
													 entityType : new(rc: RunContextServer) => T,
													 key 				: keyof T,
													 values     : Array<any>,
													 limit 			: number = -1,
													 offset 		: number = 0,
													 range     ?: ObmopRange<T>,
													 sort 		 ?: ObmopSort<T>) : Promise<ObmopQueryRetval<T>> {

		const tableName = new entityType(rc).getTableName(),
					fields    = ObmopRegistryManager.getRegistry(tableName).getFieldNames()
							
		rc.isDebug() && rc.debug(rc.getName(this), 'Fetching data.', tableName, key, 
														 values, range, sort)
		
		try {
			const records = await this.client.queryIn(rc, tableName, fields, key as string,
																								values, limit, offset, range as QueryRange,
																							  sort as QuerySort)

			const result : ObmopQueryRetval<T> = {
				entities : records.entities.map((record) => {
																											const entity = new entityType(rc)

																											Object.assign(entity, record)
																											return entity
																										}),
				totalCount : records.totalCount
			}			
			
			return result

		} catch(err) {
			const mErr = new Mubble.uError(DB_ERROR_CODE, `Error in querying ${tableName}.`)
			rc.isError() && rc.error(rc.getName(this), mErr, err)
			throw mErr
		}
	}
	/**
   *  Function to insert a row of an obmop entity.
   */
  public async insert<T extends ObmopBaseEntity>(rc : RunContextServer, entity : T) {

		const tableName = entity.getTableName(),
					entityObj = {} as Mubble.uObject<any>,
					keys      = Object.keys(entity)
					

    for(const key of keys) {
      if(entity.hasOwnProperty(key) && !key.startsWith('_')) entityObj[key] = (entity as any)[key]
		}

		const failed = this.verifyEntityBeforeInserting(rc, tableName, entityObj)
		if(failed) {
			throw new Mubble.uError(DB_ERROR_CODE, failed)
		}

		rc.isDebug() && rc.debug(rc.getName(this), 'Inserting data.', tableName, entity, '=>', entityObj)

		try {
			const sequenceFields = this.getSequenceFields(tableName)
				
			if (sequenceFields.length) {
				let sequences : Mubble.uObject<string> = {}
				
				sequenceFields.forEach(sequenceField => {
					if(sequenceField.sequence) sequences[sequenceField.name] = sequenceField.sequence
				})

				await this.client.insert(rc, tableName, entityObj, sequences)
			} else {
				await this.client.insert(rc, tableName, entityObj)
			}
		} catch(err) {
			const mErr = new Mubble.uError(DB_ERROR_CODE, `Error in inserting ${entity} into ${tableName}.`)
			rc.isError() && rc.error(rc.getName(this), mErr, err)
			throw mErr
		}
	}
	/**
	 *	Function to insert multiple rows into a table at once
	 */
	public async mInsert<T extends ObmopBaseEntity>(rc : RunContextServer, entities : T[]) {

		const tableName 	= entities[0].getTableName(),
					entitiesArr = [] as Array<Mubble.uObject<any>>,
					keys				= Object.keys(entities[0])

		for (const entity of entities) {
			const entityObj = {} as Mubble.uObject<any>

			for (const key of keys) {
				if (entity.hasOwnProperty(key) && !key.startsWith('_')) entityObj[key] = (entity as any)[key]
			}
			entitiesArr.push(entityObj)
		}

		entitiesArr.forEach(entityObj => {
			const failed = this.verifyEntityBeforeInserting(rc, tableName, entityObj)
			if(failed) {
				throw new Mubble.uError(DB_ERROR_CODE, failed)
			}
		})

		rc.isDebug() && rc.debug(rc.getName(this), 'Inserting multiple rows', tableName, entities, '=>', entitiesArr)

		const sequenceFields = this.getSequenceFields(tableName)

		let sequences : Mubble.uObject<string> | undefined = undefined

		if(sequenceFields.length) {
			sequences = {}

			sequenceFields.forEach(sequenceField => {
				if(sequences && sequenceField.sequence) sequences[sequenceField.name] = sequenceField.sequence
			})
		}

		try {

			if(this.client.mInsert) {
				await this.client.mInsert(rc, tableName, entitiesArr, sequences)
			} else {
				await Promise.all(entitiesArr.map((ent) => this.client.insert(rc, tableName, ent, sequences)))
			}
		} catch(e) {
			const mErr = new Mubble.uError(DB_ERROR_CODE, `Error in inserting ${entities} into ${tableName}.`)
			rc.isError() && rc.error(rc.getName(this), mErr, e)
			throw mErr
		}
	}

	/**
   *  Function to update a row of an obmop entity.
	 *  The fields to be updated are given in the updates object with the respective new values.
	 *  The function also updates the entity.
   */
	public async update<T extends ObmopBaseEntity>(rc 		 : RunContextServer,
																								 entity  : T,
																								 updates : Mubble.uChildObject<T>) {

		const tableName = entity.getTableName(),
					failed    = this.verifyEntityBeforeUpdating(rc, tableName, updates)
		
		if(failed) {
			throw new Mubble.uError(DB_ERROR_CODE, failed)
		}

		const primaryKey      = ObmopRegistryManager.getRegistry(tableName).getPrimaryKey(),
					primaryKeyValue = (entity as any)[primaryKey]

		rc.isDebug() && rc.debug(rc.getName(this), 'Updating data.', tableName, entity, '=>', updates)

		try {
			await this.client.update(rc, tableName, updates, primaryKey, primaryKeyValue)

		} catch(err) {
			const mErr = new Mubble.uError(DB_ERROR_CODE, `Error in updating ${entity} with ${updates} into ${tableName}.`)
			rc.isError() && rc.error(rc.getName(this), mErr, err)
			throw mErr
		}

		Object.assign(entity, updates)
	}

	/**
   *  Function to hard delete a row of an obmop entity.
	 * 	There are no updates to the entity object.
	 *  Make sure not to operate on a deleted entity.
   */
	public async hardDelete<T extends ObmopBaseEntity>(rc : RunContextServer, entity : T) {

		const tableName       = entity.getTableName(),
					primaryKey      = ObmopRegistryManager.getRegistry(tableName).getPrimaryKey(),
					primaryKeyValue = (entity as any)[primaryKey]

		rc.isDebug() && rc.debug(rc.getName(this), 'Deleting (hard-delete) data.', tableName, entity)

		try {
			await this.client.delete(rc, tableName, primaryKey, primaryKeyValue)

		} catch(err) {
			const mErr = new Mubble.uError(DB_ERROR_CODE, `Error in deleting (hard) ${entity} from ${tableName}.`)
			rc.isError() && rc.error(rc.getName(this), mErr, err)
			throw mErr
		}
	}
	
/*------------------------------------------------------------------------------
	 PRIVATE METHODS
------------------------------------------------------------------------------*/

	// Verifies entity object before inserting. Returns false if successfully verified or the error message.
	private verifyEntityBeforeInserting(rc 				: RunContextServer,
																			entity    : string,
																			entityObj : Mubble.uObject<any>) : string | false {

		rc.isDebug() && rc.debug(rc.getName(this), 'Verifying entity before insertion.', entity, entityObj)

		const registry     = ObmopRegistryManager.getRegistry(entity),
					baseRegistry = ObmopRegistryManager.getRegistry(ObmopBaseEntity.name.toLowerCase())
		
		// verifying if all keys are registered fields
		const keys           = Object.keys(entityObj),
					fieldNames 		 = registry.getFieldNames(),
					baseFieldNames = baseRegistry.getFieldNames()

		for(const key of keys) {
			if(!lo.includes(fieldNames, key) && !lo.includes(baseFieldNames, key)) {
				return ObmopErrorMessage.UNKNOWN_INSERT
			}
		}

		// verifying if primary key is present if not serialized and not a sequence
		const primaryKey = registry.getPrimaryKeyInfo()
		if(!primaryKey.serial && !primaryKey.sequence && !entityObj[primaryKey.name]) {
			return ObmopErrorMessage.PK_INSERT
		}

		// verifying if not null fields are present
		const notNullFields = registry.getNotNullFields(),
					notNullVerify = notNullFields.every((field : ObmopFieldInfo) => {
						if(field.serial || field.sequence) return true
						return (entityObj[field.name] === undefined || entityObj[field.name] === null)
					})

		if(notNullVerify) {
			return ObmopErrorMessage.NOT_NULL_INSERT
		}

		// verifying if serial fields are inserted manually
		const serialFields = registry.getSerializedFields(),
					serialVerify = serialFields.every((field : ObmopFieldInfo) => {
						return !entityObj[field.name]
					})

		if(!serialVerify) {
			return ObmopErrorMessage.SERIAL_INSERT
		}

		// verifying if sequence fields are inserted manually
		const sequenceFields = registry.getSequenceFields(),
		 			sequenceVerify = sequenceFields.every((sequenceField : ObmopFieldInfo) => {
						return !entityObj[sequenceField.name]
					})

		if(!sequenceVerify) {
			return ObmopErrorMessage.SEQUENCE_INSERT
		}

		// TODO : verify uniqueness

    return false
  }

	// Verifies updates object before updating. Returns false if successfully verified or the error message.
	private verifyEntityBeforeUpdating(rc      : RunContextServer,
																		 entity  : string,
																		 updates : Mubble.uObject<any>) : string | false {

		rc.isDebug() && rc.debug(rc.getName(this), 'Verifying updates before updating.', entity, updates)

		const registry     = ObmopRegistryManager.getRegistry(entity),
					baseRegistry = ObmopRegistryManager.getRegistry(ObmopBaseEntity.name.toLowerCase())
		
		// verifying if all keys are registered fields
		const keys           = Object.keys(updates),
					fieldNames 		 = registry.getFieldNames(),
					baseFieldNames = baseRegistry.getFieldNames()

		for(const key of keys) {
			if(!lo.includes(fieldNames, key) && !lo.includes(baseFieldNames, key)) {
				return ObmopErrorMessage.UNKNOWN_UPDATE
			}
		}

		// verifying if updates also contains the primary key
		const primaryKey = registry.getPrimaryKeyInfo()
		if(updates[primaryKey.name]) {
			return ObmopErrorMessage.PK_UPDATE
		}

		// verifying if serial fields are updated manually
		const serialFields = registry.getSerializedFields(),
					serialVerify = serialFields.every((serialField : ObmopFieldInfo) => {
						return !updates[serialField.name]
					})

		if(!serialVerify) {
			return ObmopErrorMessage.SERIAL_UPDATE
		}

		// verifying if sequence fields are updated manually
		const sequenceFields = registry.getSequenceFields(),
					sequenceVerify = sequenceFields.every((sequenceField : ObmopFieldInfo) => {
						return !updates[sequenceField.name]
					})

		if(!sequenceVerify) {
			return ObmopErrorMessage.SEQUENCE_UPDATE
		}

		// TODO : verify uniqueness

    return false
	}
	
	private getSequenceFields(entity : string) : ObmopFieldInfo[] {
		return ObmopRegistryManager.getRegistry(entity).getSequenceFields()
	}
}