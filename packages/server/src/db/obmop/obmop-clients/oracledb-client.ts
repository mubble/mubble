/*------------------------------------------------------------------------------
   About      : Oracle DB client to interact with oracle DB server
   
   Created on : Thu Jun 20 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import { RunContextServer }  	 	from '../../../rc-server'
import { ObmopBaseClient }      from '../obmop-base'
import { DB_ERROR_CODE }        from '../obmop-util'
import { Mubble }	              from '@mubble/core'
import * as oracledb            from 'oracledb'
import { format } from 'util'

/*------------------------------------------------------------------------------
   OracleDb Config
------------------------------------------------------------------------------*/

export type OracleDbConfig = oracledb.PoolAttributes

/*------------------------------------------------------------------------------
   OracleDb Client
------------------------------------------------------------------------------*/

export class OracleDbClient implements ObmopBaseClient {

	private clientPool  : oracledb.Pool
  private initialized : boolean		              = false
  private poolConfig  : oracledb.PoolAttributes

	constructor(rc : RunContextServer, config : OracleDbConfig) {
		rc.isDebug() && rc.debug(rc.getName(this), 'Constructing new OracleDbClient.', config)

		this.poolConfig = config
	}

	public async init(rc : RunContextServer) {
		rc.isDebug() && rc.debug(rc.getName(this), 'Initializing OracleDbClient.', this.poolConfig)

		this.clientPool = await new Promise<oracledb.Pool>((resolve, reject) => {
      oracledb.createPool(this.poolConfig, (err : oracledb.DBError, pool : oracledb.Pool) => {
        if(err) reject(err)
        resolve(pool)
      })
    })

		this.initialized = true
	}

	public async close(rc : RunContextServer) {
		if(!this.initialized) return

		rc.isDebug() && rc.debug(rc.getName(this), 'Closing OracleDbClient.')

		await this.clientPool.close()
		this.initialized = false
	}

	public async queryAll(rc : RunContextServer, table : string, fields : Array<string>) : Promise<Array<any>> {

		rc.isDebug() && rc.debug(rc.getName(this), 'Fetching everything from table, ' + table + '.')

		const fieldString = fields.join(', '),
					queryString = `SELECT ${fieldString} FROM ${table}`,
					result      = await this.bindsQuery(rc, queryString, [])

		return this.convertResultArray(result)
	}

	public async query(rc       : RunContextServer,
										 table    : string,
										 fields   : Array<string>,
										 key      : string,
										 value    : any,
										 operator : string = '=') : Promise<Array<any>> {

		rc.isDebug() && rc.debug(rc.getName(this), 'Fetching from table, ' + table + ' with condition : ',
														 key, operator, value)

		const fieldString = fields.join(', '),
					queryString = `SELECT ${fieldString} FROM ${table} WHERE ${key} ${operator} :1`,
					binds       = [] as Array<any>

		binds.push(value)

		const result = await this.bindsQuery(rc, queryString, binds)

		return this.convertResultArray(result)
	}

	public async queryAnd(rc 				 : RunContextServer,
												table 		 : string,
												fields     : Array<string>,
												conditions : Array<{key : string, value : any, operator ?: string}>) : Promise<Array<any>> {

		rc.isDebug() && rc.debug(rc.getName(this), 'Fetching from table, ' + table + ' with conditions :', conditions)

		const fieldString	 		 = fields.join(', '),
				  conditionStrings = [] as Array<string>,
					binds            = [] as Array<any>

		let c = 1

		for(const condition of conditions) {
			conditionStrings.push(`${condition.key} ${condition.operator || '='} :${c++}`)
			binds.push(condition.value)
		}

		const queryString = `SELECT ${fieldString} FROM ${table} WHERE ${conditionStrings.join(' AND ')}`,
					result      = await this.bindsQuery(rc, queryString, binds)

		return this.convertResultArray(result)
	}

	public async insert(rc : RunContextServer, table : string, entity : Mubble.uObject<any>, sequences ?: Mubble.uObject<string>) {

		rc.isDebug() && rc.debug(rc.getName(this), 'Inserting into table, ' + table + '.', entity)

		const keys   = Object.keys(entity),
					values = [] as Array<string>

		for(const key of keys) {
			values.push(`:${key}`)
		}

		if(sequences) {
			const sequenceKeys : Array<string> = Object.keys(sequences),
						sequenceVals : Array<string> = Object.values(sequences)

			keys.push(...sequenceKeys)
			values.push(...sequenceVals.map(sequenceName => `${sequenceName}.NEXTVAL`))
		}

		const queryString = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${values.join(', ')})`
					
		await this.bindsQuery(rc, queryString, entity)
	}

	public async mInsert(rc : RunContextServer, table : string, entities : Mubble.uObject<any>[], sequences ?: Mubble.uObject<string>) {
		
		rc.isDebug() && rc.debug(rc.getName(this), 'Inserting multiple rows into table, ' + table + '.' + entities)

		const binds 		: Array<any>		= [],
					keys			: Array<string>	= Object.keys(entities[0]),
					bindsKeys : Array<string> = keys.map(key => `:${key}`)

		if(sequences) {
			const sequenceKeys : Array<string> = Object.keys(sequences),
						sequenceVals : Array<string> = Object.values(sequences)

			keys.push(...sequenceKeys)
			bindsKeys.push(...sequenceVals.map(sequenceName => `${sequenceName}.NEXTVAL`))
		}

		for (const entity of entities) {

			const bind : any = {}

			for (const key in entity) {
				if (entity.hasOwnProperty(key)) {
					bind[key] = entity[key]
				}
			}

			binds.push(bind)
		}

		const queryString = `INSERT INTO ${table} (${keys.join(', ')})`
												+ `values (${bindsKeys.join(', ')})`

		this.bindsQueryMany(rc, queryString, binds)

	}

	public async update(rc 				  : RunContextServer,
											table 		  : string,
											updates     : Mubble.uObject<any>,
											queryKey    : string,
											queryValue  : any, 
											sequences  ?: Mubble.uObject<string>) {

		rc.isDebug() && rc.debug(rc.getName(this),
														 `Updating ${table} with updates : ${updates} for ${queryKey} : ${queryValue}.`)

		const updateKeys = Object.keys(updates),
					changes    = [] as Array<string>,
					binds      = [] as Array<any>

		let c = 1

		for(const key of updateKeys) {
			changes.push(`${key} = :${c++}`)
			binds.push(updates[key])
		}

		if(sequences) {
			for (const key in sequences) {
				if (sequences.hasOwnProperty(key)) {
					changes.push(`${key} = ${sequences[key]}.NEXTVAL`)
				}
			}
		}

		const queryString = `UPDATE ${table} `
												+ `SET ${changes.join(', ')} `
												+ `WHERE ${queryKey} = :${c}`

		binds.push(queryValue)

		await this.bindsQuery(rc, queryString, binds)
	}

	public async delete(rc : RunContextServer, table : string, queryKey : string, queryValue : any) {
		rc.isDebug() && rc.debug(rc.getName(this), `Deleting from ${table}, ${queryKey} : ${queryValue}.`)

		const queryString = `DELETE FROM ${table} WHERE ${queryKey} = :1`,
					binds 			= [] as Array<any>

		binds.push(queryValue)

		await this.bindsQuery(rc, queryString, binds)
	}

/*------------------------------------------------------------------------------
	 PRIVATE METHODS
------------------------------------------------------------------------------*/

	private async bindsQuery(rc : RunContextServer, queryString : string, binds : oracledb.BindParameters) {

		rc.isDebug() && rc.debug(rc.getName(this), 'bindQuery', queryString, binds)

		if(!this.initialized) await this.init(rc)
    
		const connection = await this.clientPool.getConnection(),
					options    = { autoCommit : true }

		try {
			const result = await new Promise<oracledb.Result<any>>((resolve, reject) => {

				connection.execute(queryString, binds, options, (err : oracledb.DBError, result : oracledb.Result<any>) => {
          if(err) reject(err)
          resolve(result)
        })
			})
			
			return result
		} catch(e) {

			rc.isError() && rc.error(rc.getName(this), 'Error in executing query.', queryString, e)
			throw new Mubble.uError(DB_ERROR_CODE, e.message)
		} finally {
			await connection.close()
		}
	}

	private async bindsQueryMany(rc : RunContextServer, queryString : string, binds : oracledb.BindParameters[]) {
		rc.isDebug() && rc.debug(rc.getName(this), 'bindsQueryMany', queryString, binds)

		if (!this.initialized) await this.init(rc)

		const connection = await this.clientPool.getConnection(),
					options 	 = {autoCommit : true}

		try {
			const result = await new Promise<oracledb.Result<any>>((resolve, reject) => {
				connection.executeMany(queryString, binds, options, (err : oracledb.DBError, result : oracledb.Result<any>) => {
					if (err) reject(err)
					resolve(result)
				})
			})

			return result
		} catch (e) {

			rc.isError() && rc.error(rc.getName(this), 'Error in executing query.', queryString, e)
			throw new Mubble.uError(DB_ERROR_CODE, e.message)
		} finally {
			await connection.close()
		}
	}

	private getStringValue(value : any) : string {
		if(value instanceof Date) {
			return `'${format(value, DATE_FORMAT_STRING)}'`
		}

		return `${typeof(value) == STRING_TYPE ? '\'' + value + '\'' : value}`
	}

	private convertResultArray(result : oracledb.Result<any>) : Array<any> {

		const metadata = result.metaData || [],
					rows     = result.rows || [],
					finArr   = []

		for(const row of rows) {
			const elem = {} as any

			for(const index in metadata) {
				elem[metadata[index].name.toLowerCase()] = row[index]
			}

			finArr.push(elem)
		}

		return finArr
	}
}