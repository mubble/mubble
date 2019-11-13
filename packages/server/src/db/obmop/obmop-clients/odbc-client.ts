/*------------------------------------------------------------------------------
   About      : ODBC client to interact with relational database server
   
   Created on : Thu Jun 20 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import { 
				 Mubble,
				 format
			 }               								from '@mubble/core'
import { ObmopBaseClient }      			from '../obmop-base'
import { RunContextServer }   				from '../../../rc-server'
import { DB_ERROR_CODE }      				from '../obmop-util'

const odbc = require('odbc')

const STRING_TYPE 			 = 'string',
			DATE_FORMAT_STRING = '%yyyy%-%mm%-%dd% %hh%:%nn%:%ss%.%ms%'

export class OdbcClient implements ObmopBaseClient {

	private clientPool 			 : any
	private initialized 		 : boolean = false
	private connectionString : string

	constructor(rc : RunContextServer, connectionString : string) {
		rc.isDebug() && rc.debug(rc.getName(this), 'Constructing new odbc client.', connectionString)

		this.connectionString = connectionString
	}

	public async init(rc : RunContextServer) {
		rc.isDebug() && rc.debug(rc.getName(this), 'Initializing odbc client.', this.connectionString)

		this.clientPool = await new Promise((resolve, reject) => {

			odbc.pool(this.connectionString, (err : any, pool : any) => {

				if(err) {
					this.initialized = false
					const errMsg = 'Error in creating odbc connection pool.'
					rc.isError() && rc.error(rc.getName(this), errMsg, err)
					return reject(new Mubble.uError(DB_ERROR_CODE, errMsg))
				}

				this.initialized = true
				resolve(pool)
			})
		})
	}

	public async close(rc : RunContextServer) {
		if(!this.initialized) return

		rc.isDebug() && rc.debug(rc.getName(this), 'Closing odbc client.')

		await this.clientPool.close()
		this.initialized = false
	}

	public async queryAll(rc 		 : RunContextServer,
												table  : string,
												fields : Array<string>) : Promise<Array<Mubble.uObject<any>>> {

		rc.isDebug() && rc.debug(rc.getName(this), 'Fetching everything from table, ' + table + '.')

		const fieldString = fields.join(', '),
					queryString = `SELECT ${fieldString} FROM ${table}`,
					result      = await this.queryInternal(rc, queryString)

		return result.rows
	}

	public async query(rc       : RunContextServer,
										 table    : string,
										 fields   : Array<string>,
										 key      : string,
										 value    : any,
										 operator : string = '=') : Promise<Array<Mubble.uObject<any>>> {

		rc.isDebug() && rc.debug(rc.getName(this), 'Fetching from table, ' + table + ' with condition : ',
														 key, operator, value)

		const fieldString = fields.join(', '),
					queryString = `SELECT ${fieldString} FROM ${table} WHERE ${this.getConditionString(key, value, operator)}`,
					result      = await this.queryInternal(rc, queryString)

		return result.rows
	}


	public async queryAnd(rc 				 : RunContextServer,
												table 		 : string,
												fields     : Array<string>,
												conditions : Array<{key : string, value : any, operator ?: string}>) : Promise<Array<any>> {

		rc.isDebug() && rc.debug(rc.getName(this), 'Fetching from table, ' + table + ' with conditions :', conditions)

		const fieldString = fields.join(', '),
					conditionStrings = conditions.map((condition) =>
															 this.getConditionString(condition.key, condition.value, condition.operator)),
					condition        = conditionStrings.join(' AND '),
					queryString      = `SELECT ${fieldString} FROM ${table} WHERE ${condition}`,
					result      		 = await this.queryInternal(rc, queryString)

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
	
	private async queryInternal(rc : RunContextServer, queryString : string) : Promise<any> {
		rc.isDebug() && rc.debug(rc.getName(this), 'queryInternal', queryString)

		try {
			if(!this.initialized) await this.init(rc)

			const result = await new Promise<any>((resolve, reject) => {
				this.clientPool.query(queryString, (err : Error, result : any) => {
					err ? reject(err)
							: resolve(result)
				})
			})
			
			return result
		} catch(e) {
			throw new Mubble.uError(DB_ERROR_CODE, e.message)
		}
	}

	private getStringValue(value : any) : string {
		if(value instanceof Date) {
			return `'${format(value, DATE_FORMAT_STRING)}'`
		}

		return `${typeof(value) == STRING_TYPE ? '\'' + value + '\'' : value}`
	}

	private getConditionString(key : string, value : any, operator : string = '=') : string {
		return `${key} ${operator} ${this.getStringValue(value)}`
	}
}