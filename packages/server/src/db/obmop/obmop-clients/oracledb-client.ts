/*------------------------------------------------------------------------------
   About      : Oracle DB client to interact with oracle DB server
   
   Created on : Thu Jun 20 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import { 
				 ObmopBaseClient,
				 QueryRetval,
				 QueryRange,
				 QuerySort,
				 QueryCondition
			 }      									from '../obmop-base'
import { RunContextServer }  	 	from '../../../rc-server'
import { DB_ERROR_CODE }        from '../obmop-util'
import { Mubble }	              from '@mubble/core'
import * as oracledb            from 'oracledb'

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
		rc.isDebug() && rc.debug(rc.getName(this), 'Constructing new OracleDbClient.')

		this.poolConfig = config
	}

	public async init(rc : RunContextServer) {
		rc.isDebug() && rc.debug(rc.getName(this), 'Initializing OracleDbClient.')

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

	public async query(rc      : RunContextServer,
										 table   : string,
										 fields  : Array<string>,
										 query  ?: QueryCondition,
										 limit   : number = -1,
										 offset  : number = 0,
										 range  ?: QueryRange,
										 sort   ?: QuerySort) : Promise<QueryRetval> {

		rc.isDebug() && rc.debug(rc.getName(this), 'Fetching from table,', table)

		let c = query ? query.binds.length : 0

		const fieldString = fields.join(', '),
					binds       = query ? query.binds : [] as Array<any>,
					addQuery    = query && query.queryStr ? range ? ` WHERE ${query.queryStr} AND`
																												: ` WHERE ${query.queryStr}`
															                  : range ? ' WHERE'
																											  : '',																		
					addRange    = range ? ` ${range.key} BETWEEN ${range.low} AND ${range.high}`
														  : '',
					addSort     = sort ? ` ORDER BY ${sort.key} ${sort.order}`
														 : ''

		let queryString = `SELECT ${fieldString} FROM ${table}` + addQuery + addRange + addSort		

		if(limit !== -1) {
			queryString = `SELECT ${fieldString}, totcount FROM (`
										+ `SELECT COUNT(*) OVER() AS TOTCOUNT, T1.* FROM ${table} T1`
										+ addQuery
										+ addRange
										+ addSort
										+ `) OFFSET :${++c} ROWS FETCH NEXT :${++c} ROWS ONLY`

			binds.push(`${offset}`)
			binds.push(`${limit}`)						 				
		}

		const entities = this.convertResultArray(await this.bindsQuery(rc, queryString, binds))

		const result : QueryRetval = {
			entities,
			totalCount : entities.length
		}

		if(limit !== -1 && entities.length) result.totalCount = entities[0].totcount

		return result
	}

	public async sql(rc : RunContextServer, query : string, binds : Array<any>) : Promise<Array<Mubble.uObject<any>>> {

		rc.isDebug() && rc.debug(rc.getName(this), 'Executing query.', query, binds)

		const entities = this.convertResultArray(await this.bindsQuery(rc, query, binds))

		return entities
	}

	public async insert(rc				 : RunContextServer,
											table			 : string,
											entity		 : Mubble.uObject<any>,
											sequences ?: Mubble.uObject<string>) {

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

	public async mInsert(rc					: RunContextServer,
											 table 			: string,
											 entities   : Mubble.uObject<any>[],
											 sequences ?: Mubble.uObject<string>) {
		
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
												+ ` values (${bindsKeys.join(', ')})`

		await this.bindsQuery(rc, queryString, binds, true)
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
	
	public async mDelete(rc : RunContextServer, table : string, queryKey : string, queryValues : Array<any>) {
		rc.isDebug() && rc.debug(rc.getName(this), `Deleting from ${table}, ${queryKey} : ${queryValues}.`)

		const binds = [] as Array<any>

		let c 			 = 0,
				bindKeys = [] as Array<string>

		for(const qValue of queryValues) {
			bindKeys.push(`:${++c}`)
			binds.push(qValue)
		}

		const queryString = `DELETE FROM ${table} WHERE ${queryKey} IN (${bindKeys.join(', ')})`

		await this.bindsQuery(rc, queryString, binds)
	}

/*------------------------------------------------------------------------------
	 PRIVATE METHODS
------------------------------------------------------------------------------*/

	private async bindsQuery(rc					  : RunContextServer,
													 queryString  : string,
													 binds 			  : oracledb.BindParameters[] | oracledb.BindParameters,
													 multiple    ?: boolean) {

		rc.isDebug() && rc.debug(rc.getName(this), 'bindQuery executing', queryString, binds)

		if(!this.initialized) await this.init(rc)
    
		const connection = await this.clientPool.getConnection(),
					options    = { autoCommit : true }

		try {
			const result = await new Promise<oracledb.Result<any>>((resolve, reject) => {

				if(multiple) {
					connection.executeMany(queryString, binds as oracledb.BindParameters[], options,
																 (err : oracledb.DBError, result : oracledb.Result<any>) => {
						if (err) {
							return reject(err)}
						return resolve(result)
					})
				} else {
					connection.execute(queryString, binds, options, (err : oracledb.DBError, result : oracledb.Result<any>) => {
						if(err) return reject(err)
						return resolve(result)
					})
				}
			})

			rc.isDebug() && rc.debug(rc.getName(this), 'bindQuery executed', queryString, binds, result)
			
			return result
		} catch(e) {
			rc.isError() && rc.error(rc.getName(this), 'Error in executing query.', queryString, binds, e)
			throw new Mubble.uError(DB_ERROR_CODE, e.message)
		} finally {
			await connection.close()
		}
	}

	private convertResultArray(result : oracledb.Result<any>) : Array<Mubble.uObject<any>> {

		const metadata = result.metaData || [],
					rows     = result.rows || [],
					finArr   = [] as Array<Mubble.uObject<any>>

		for(const row of rows) {
			const elem = {} as Mubble.uObject<any>

			for(const index in metadata) {
				elem[metadata[index].name.toLowerCase()] = row[index]
			}

			finArr.push(elem)
		}

		return finArr
	}
}