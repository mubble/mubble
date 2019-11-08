/*------------------------------------------------------------------------------
   About      : Postgres client to interact with postgres DB server
   
   Created on : Thu Jun 20 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import { 
				 Mubble,
				 format
			 }	               				from '@mubble/core'
import { ObmopBaseClient }      from '../obmop-base'
import { RunContextServer }  	 	from '../../../rc-server'
import { DB_ERROR_CODE }        from '../obmop-util'
import * as pg                  from 'pg'
import * as stream              from 'stream'

const STRING_TYPE 			 = 'string',
			DATE_FORMAT_STRING = '%yyyy%-%mm%-%dd% %hh%:%nn%:%ss%.%ms%'

/*------------------------------------------------------------------------------
   Postgres Config
------------------------------------------------------------------------------*/

export type PostgresConfig = {
	user               : string
	database           : string
	password           : string
	port               : number
	host               : string
	connectionString  ?: string
	keepAlive         ?: boolean
	stream            ?: stream.Duplex
	statementTimeout  ?: false | number
	ssl               ?: boolean
}

/*------------------------------------------------------------------------------
   Postgres Client
------------------------------------------------------------------------------*/

export class PostgresClient implements ObmopBaseClient {

	private clientPool  : pg.Pool
	private db     			: string
	private initialized : boolean		      = false
	private pgConfig    : pg.ClientConfig

	constructor(rc : RunContextServer, config : PostgresConfig) {
		rc.isDebug() && rc.debug(rc.getName(this), 'Constructing new PostgresClient.', config)

		const pgConfig : pg.ClientConfig = config
		pgConfig.statement_timeout = config.statementTimeout

		this.pgConfig = pgConfig
		this.db       = config.database
	}

	public async init(rc : RunContextServer) {
		rc.isDebug() && rc.debug(rc.getName(this), 'Initializing PostgresClient.', this.db)

		this.clientPool = new pg.Pool(this.pgConfig)

		this.clientPool.on('error', (err) => {
			rc.isError() && rc.error(rc.getName(this), 'Some unexpected error occured in postgres client pool.', err)
			this.initialized = false
		})

		this.initialized = true
	}

	public async close(rc : RunContextServer) {
		if(!this.initialized) return

		rc.isDebug() && rc.debug(rc.getName(this), 'Closing PostgresClient.', this.db)

		await this.clientPool.end()
		this.initialized = false
	}

	public async queryAll(rc : RunContextServer, table : string) : Promise<Array<any>> {
		rc.isDebug() && rc.debug(rc.getName(this), 'Fetching everything from table, ' + table + '.')

		const queryString = `SELECT * FROM ${table}`,
					result      = await this.queryInternal(rc, queryString)

		return result.rows
	}

	public async query(rc        : RunContextServer,
										 table     : string,
										 key       : string,
										 value     : any,
										 condition : string = '=') : Promise<Array<any>> {

		rc.isDebug() && rc.debug(rc.getName(this), 'Fetching from table, ' + table + ' with condition : ',
														 key, condition, value)

		const queryString = `SELECT * FROM ${table} WHERE ${key} ${condition} ${this.getStringValue(value)}`,
					result      = await this.queryInternal(rc, queryString)

		return result.rows
	}

	public async insert(rc : RunContextServer, table : string, entity : Mubble.uObject<any>) {

		rc.isDebug() && rc.debug(rc.getName(this), 'Inserting into table, ' + table + '.', entity)

		const keys        = Object.keys(entity),
					values      = Object.values(entity),
					keysStr     = keys.join(', '),
					valuesStr   = (values.map((value) => this.getStringValue(value))).join(', '),
					queryString = `INSERT INTO ${table} (${keysStr}) VALUES (${valuesStr})`

		await this.queryInternal(rc, queryString)
	}

	public async update(rc 				 : RunContextServer,
											table 		 : string,
											updates    : Mubble.uObject<any>,
											queryKey   : string,
											queryValue : any) {

		rc.isDebug() && rc.debug(rc.getName(this),
														 `Updating ${table} with updates : ${updates} for ${queryKey} : ${queryValue}.`)

		const updateKeys = Object.keys(updates),
					changes    = [] as Array<string>

		for(const key of updateKeys) {
			changes.push(`${key} = ${this.getStringValue(updates[key])}`)
		}

		const queryString = `UPDATE ${table} `
												+ `SET ${changes.join(', ')} `
												+ `WHERE ${queryKey} = ${this.getStringValue(queryValue)}`

		await this.queryInternal(rc, queryString)
	}

	public async delete(rc : RunContextServer, table : string, queryKey : string, queryValue : any) {
		rc.isDebug() && rc.debug(rc.getName(this), `Deleting from ${table}, ${queryKey} : ${queryValue}.`)

		const queryString = `DELETE FROM ${table} WHERE ${queryKey} = ${this.getStringValue(queryValue)}`

		await this.queryInternal(rc, queryString)
	}

/*------------------------------------------------------------------------------
	 PRIVATE METHODS
------------------------------------------------------------------------------*/
	
	private async queryInternal(rc : RunContextServer, queryString : string) : Promise<pg.QueryResult> {
		rc.isDebug() && rc.debug(rc.getName(this), 'queryInternal', queryString)

		if(!this.initialized) await this.init(rc)

		const client : pg.PoolClient = await this.clientPool.connect()

		try {
			const result = await new Promise<pg.QueryResult>((resolve, reject) => {
				client.query(queryString, (err : Error, result : pg.QueryResult) => {
					err ? reject(err)
							: resolve(result)
				})
			})
			
			return result
		} catch(e) {
			rc.isError() && rc.error(rc.getName(this), 'Error in executing query.', queryString, e)
			throw new Mubble.uError(DB_ERROR_CODE, e)
		} finally {
			client.release()
		}
	}

	private getStringValue(value : any) : string {
		if(value instanceof Date) {
			return `'${format(value, DATE_FORMAT_STRING)}'`
		}

		return `${typeof(value) == STRING_TYPE ? '\'' + value + '\'' : value}`
	}
}