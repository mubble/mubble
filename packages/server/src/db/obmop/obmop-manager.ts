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
				 ObmopFieldInfo, 
				 ObmopFieldNameMapping
			 } 														from './obmop-registry'
import { ObmopQueryCondition }			from './obmop-query'			 
import { RunContextServer }   			from '../../rc-server'
import { Mubble } 									from '@mubble/core'

export type ObmopQueryRetval<T> = {
	entities   : Array<T>
	totalCount : number
}

export type ObmopRange<T> = {
	key  : keyof T
	low  : any
	high : any
}

export enum SORT_MODE  {
	ASC  = 'ASC',
  DESC = 'DESC'
}

export type ObmopSort<T> = {
	key   : keyof T
	order : SORT_MODE
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
	 * Function to fetch all entries/row(S) of given table as per condition
	 */
  public async query<T extends ObmopBaseEntity>(rc         : RunContextServer,
		                                            entityType : new(rc : RunContextServer) => T,
		                                            query     ?: ObmopQueryCondition<T>,
		                                            limit      : number = -1,
		                                            offset     : number = 0,
		                                            range     ?: ObmopRange<T>,
		                                            sort      ?: ObmopSort<T>) : Promise<ObmopQueryRetval<T>> {

		const tableName = new entityType(rc).getTableName(),
					fields    = ObmopRegistryManager.getRegistry(tableName).getFieldNamesAndMappings()

		rc.isDebug() && rc.debug(rc.getName(this), 'Fetching data.', tableName, query, limit,
														 offset, range, sort)
		
		if (query) query.queryStr = this.convertQueryFieldNamesToMappings(rc, query.queryStr, fields)
		try {
			const records = await this.client.query(rc, tableName, fields.map((f) => f.mapping), query, limit, offset,
																								 range as QueryRange, sort as QuerySort)

			const entities = records.entities.map((record) => {
				const entity = new entityType(rc)

				for (const field of fields) {
					entity[field.name as keyof T] = record[field.mapping]
				}
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
   *  Function to insert a row of an obmop entity.
   */
  public async insert<T extends ObmopBaseEntity>(rc : RunContextServer, entity : T) {

		const tableName = entity.getTableName(),
					entityObj = {} as Mubble.uObject<any>,
					registry  = ObmopRegistryManager.getRegistry(tableName),
					fields    = registry.getFieldNamesAndMappings()
					
		for(const field of fields) {
			if(entity.hasOwnProperty(field.name)) entityObj[field.mapping] = entity[field.name as keyof T]
		}

		const failed = this.verifyEntityBeforeInserting(rc, tableName, entityObj)
		if(failed) {
			throw new Mubble.uError(DB_ERROR_CODE, failed)
		}

		rc.isDebug() && rc.debug(rc.getName(this), 'Inserting data.', tableName, entity, '=>', entityObj)

		try {
			const sequenceFields = registry.getSequenceFields()
				
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
					registry    = ObmopRegistryManager.getRegistry(tableName),
					fields    	= registry.getFieldNamesAndMappings()

		for (const entity of entities) {
			const entityObj = {} as Mubble.uObject<any>

			for (const field of fields) {
				if(entity.hasOwnProperty(field.name)) entityObj[field.mapping] = entity[field.name as keyof T]
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

		const sequenceFields = registry.getSequenceFields()

		let sequences : Mubble.uObject<string> | undefined = undefined

		if(sequenceFields.length) {
			sequences = {}

			sequenceFields.forEach(sequenceField => {
				if(sequences && sequenceField.sequence) sequences[sequenceField.name] = sequenceField.sequence
			})
		}

		try {
			await this.client.mInsert(rc, tableName, entitiesArr, sequences)
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
					failed    = this.verifyEntityBeforeUpdating(rc, tableName, updates),
					fields    = ObmopRegistryManager.getRegistry(tableName).getFieldNamesAndMappings()
		
		if(failed) {
			throw new Mubble.uError(DB_ERROR_CODE, failed)
		}

		const primaryKey      = ObmopRegistryManager.getRegistry(tableName).getPrimaryKey(),
					primaryKeyValue = entity[primaryKey.name as keyof T]

		rc.isDebug() && rc.debug(rc.getName(this), 'Updating data.', tableName, entity, '=>', updates)

		try {
			const newUpdates : Mubble.uObject<any> = {}

			for (const field of fields) {
				if (updates.hasOwnProperty(field.name)) newUpdates[field.mapping] = updates[field.name as keyof T]
			}
			await this.client.update(rc, tableName, newUpdates, primaryKey.mapping, primaryKeyValue)
		} catch(err) {
			const mErr = new Mubble.uError(DB_ERROR_CODE, `Error in updating ${entity} with ${updates} into ${tableName}.`)
			rc.isError() && rc.error(rc.getName(this), mErr, err)
			throw mErr
		}

		Object.assign(entity, updates)
	}

	/**
   *  Function to delete a row of an obmop entity.
	 * 	There are no updates to the entity object.
	 *  Make sure not to operate on a deleted entity.
   */
	public async delete<T extends ObmopBaseEntity>(rc : RunContextServer, entity : T) {

		const tableName       = entity.getTableName(),
					primaryKey      = ObmopRegistryManager.getRegistry(tableName).getPrimaryKey(),
					primaryKeyValue = entity[primaryKey.name as keyof T]

		rc.isDebug() && rc.debug(rc.getName(this), 'Deleting data.', tableName, entity)

		try {
			await this.client.delete(rc, tableName, primaryKey.mapping, primaryKeyValue)

		} catch(err) {
			const mErr = new Mubble.uError(DB_ERROR_CODE, `Error in deleting ${entity} from ${tableName}.`)
			rc.isError() && rc.error(rc.getName(this), mErr, err)
			throw mErr
		}
	}

	/**
   *  Function to delete multiple rows of an obmop entity.
	 * 	There are no updates to the entity object.
	 *  Make sure not to operate on a deleted entity.
   */
	public async mDelete<T extends ObmopBaseEntity>(rc : RunContextServer, entities : T[]) {

		const tableName        = entities[0].getTableName(),
					primaryKey       = ObmopRegistryManager.getRegistry(tableName).getPrimaryKey(),
					primaryKeyValues = entities.map(entity => entity[primaryKey.name as keyof T])

		rc.isDebug() && rc.debug(rc.getName(this), 'Deleting data.', tableName, entities)					

		try {
			await this.client.mDelete(rc, tableName, primaryKey.mapping, primaryKeyValues)
		} catch(err) {
			const mErr = new Mubble.uError(DB_ERROR_CODE, `Error in deleting ${entities} from ${tableName}.`)
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

		const registry = ObmopRegistryManager.getRegistry(entity)

		// verifying if primary key is present if not serialized and not a sequence
		const primaryKey = registry.getPrimaryKeyInfo()
		if(!primaryKey.serial && !primaryKey.sequence && !entityObj[primaryKey.mapping]) {
			return ObmopErrorMessage.PK_INSERT
		}

		// verifying if not null fields are present
		const notNullFields = registry.getNotNullFields(),
					notNullVerify = notNullFields.every((field : ObmopFieldInfo) => {
						if(field.serial || field.sequence) return true
						return (entityObj[field.mapping] === undefined || entityObj[field.mapping] === null)
					})

		if(notNullVerify) {
			return ObmopErrorMessage.NOT_NULL_INSERT
		}

		// verifying if serial fields are inserted manually
		const serialFields = registry.getSerializedFields(),
					serialVerify = serialFields.every((field : ObmopFieldInfo) => {
						return !entityObj[field.mapping]
					})

		if(!serialVerify) {
			return ObmopErrorMessage.SERIAL_INSERT
		}

		// verifying if sequence fields are inserted manually
		const sequenceFields = registry.getSequenceFields(),
		 			sequenceVerify = sequenceFields.every((sequenceField : ObmopFieldInfo) => {
						return !entityObj[sequenceField.mapping]
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

		const registry = ObmopRegistryManager.getRegistry(entity)

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

	private convertQueryFieldNamesToMappings(rc 		: RunContextServer, 
																					 query	: string, 
																					 fields : Array<ObmopFieldNameMapping>) : string {

		rc.isDebug() && rc.debug(rc.getName(this), 'convertQueryFieldNamesToMappings original string', query)
		
		let queryWithMappings : string	 = query

		for (const field of fields) {
			queryWithMappings = queryWithMappings.replace(new RegExp(`[\(](${field.name})`, 'g'), `(${field.mapping}`)
		}

		rc.isDebug() && rc.debug(rc.getName(this), 'convertQueryFieldNamesToMappings converted string', queryWithMappings)

		return queryWithMappings
	}

}