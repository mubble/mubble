/*------------------------------------------------------------------------------
   About      : Postgres client to interact with postgres DB server
   
   Created on : Thu Jun 20 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import { 
				 ObmopBaseClient,
				 QueryRetval,
         QueryCondition,
         QueryRange,
         QuerySort
			 }      									from '../obmop-base'
import { RunContextServer }  	 	from '../../../rc-server'
import { DB_ERROR_CODE }        from '../obmop-util'
import { Mubble }	              from '@mubble/core'
import * as pg                  from 'pg'
import * as stream              from 'stream'

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
	private initialized : boolean		      = false
	private pgConfig    : pg.ClientConfig

	constructor(rc : RunContextServer, config : PostgresConfig) {
		rc.isDebug() && rc.debug(rc.getName(this), 'Constructing new PostgresClient.')

		const pgConfig : pg.ClientConfig = config
		pgConfig.statement_timeout = config.statementTimeout

		this.pgConfig = pgConfig
	}

	public async init(rc : RunContextServer) {
		rc.isDebug() && rc.debug(rc.getName(this), 'Initializing PostgresClient.')

		this.clientPool = new pg.Pool(this.pgConfig)

		this.clientPool.on('error', (err) => {
			rc.isError() && rc.error(rc.getName(this), 'Some unexpected error occured in postgres client pool.', err)
			this.initialized = false
		})

		this.initialized = true
	}

	public async close(rc : RunContextServer) {
		if(!this.initialized) return

		rc.isDebug() && rc.debug(rc.getName(this), 'Closing PostgresClient.')

		await this.clientPool.end()
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
					addQuery    = query ? range ? ` WHERE ${query.queryStr.replace(/:/g, '$')} AND`
																			: ` WHERE ${query.queryStr.replace(/:/g, '$')}`
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
										+ `) AS x OFFSET $${++c} ROWS FETCH NEXT $${++c} ROWS ONLY`

			binds.push(`${offset}`)
			binds.push(`${limit}`)						 				
		}
    
    const result = await this.bindsQuery(rc, queryString, binds)

    const retval = {
      entities   : result.rows,
      totalCount : result.rows.length
		}
		
		if(limit !== -1 && retval.entities.length) retval.totalCount = retval.entities[0].totcount

		return retval
	}

	public async sql(rc : RunContextServer, query : string, binds : Array<any>) : Promise<Array<Mubble.uObject<any>>> {

		rc.isDebug() && rc.debug(rc.getName(this), 'Executing query.', query, binds)

		const result = await this.bindsQuery(rc, query, binds)

		return result.rows
	}

	public async insert(rc 				 : RunContextServer, 
											table 		 : string, 
											entity 		 : Mubble.uObject<any>,
											sequences ?: Mubble.uObject<string>) {

		rc.isDebug() && rc.debug(rc.getName(this), 'Inserting into table, ' + table + '.', entity)

		const keys     = Object.keys(entity),
					bindKeys = [] as Array<string>,
					binds    = [] as Array<any>

		let c = 1

		for(const key of keys) {
			bindKeys.push(`$${c++}`)
			binds.push(entity[key])
		}			

		if(sequences) {
			const sequenceKeys : Array<string> = Object.keys(sequences),
						sequenceVals : Array<string> = Object.values(sequences)

			keys.push(...sequenceKeys)
			bindKeys.push(...sequenceVals.map(sequenceName => `NEXTVAL('${sequenceName}')`))			
		}

		const queryString = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${bindKeys.join(', ')})`

		await this.bindsQuery(rc, queryString, binds)
	}

	public async mInsert(rc 				: RunContextServer, 
											 table 			: string, 
											 entities 	: Mubble.uObject<any>[],
											 sequences ?: Mubble.uObject<string>) {

		rc.isDebug() && rc.debug(rc.getName(this), 'Inserting multiple rows into table ' + table + '.' + entities)

		const binds				 : Array<any> 	 = [],
					sequenceKeys : Array<string> = sequences ? Object.keys(sequences) : [],
					sequenceVals : Array<string> = sequences ? Object.values(sequences)
																													 .map(sequence => `NEXTVAL('${sequence}')`) 
																									 : [],
					bindsValues	 : Array<string> = [],
					keys 				 : Array<string> = Object.keys(entities[0])

		let c = 0

		entities.forEach(entity => {
			const bindValues = []

			for (const key in entity) {
				if (entity.hasOwnProperty(key)) {
					binds.push(entity[key])
					bindValues.push(`$${++c}`)
				}
			}

			sequenceVals.forEach(sequenceVal => bindValues.push(`${sequenceVal}`))
			bindsValues.push(`(${bindValues.join(', ')})`)
		})

		const queryString = `INSERT INTO ${table} (${[...keys, ...sequenceKeys].join(', ')})`
											  + ` VALUES ${bindsValues.join(', ')}`

		await this.bindsQuery(rc, queryString, binds)
	}

	public async update(rc 				  : RunContextServer,
											table 		  : string,
											updates     : Mubble.uObject<any>,
											queryKey    : string,
											queryValue  : any,
											sequences  ?: Mubble.uObject<string>) {

		rc.isDebug() && rc.debug(rc.getName(this),
														 `Updating ${table} with updates :`, updates, `for ${queryKey} : ${queryValue}.`)

		const keys		= Object.keys(updates),
					changes = [] as Array<string>,
					binds   = [] as Array<any>

		let c = 1
		
		for(const key of keys) {
			changes.push(`${key} = $${c++}`)
			binds.push(updates[key])
		}

		if(sequences) {
			for(const key in sequences) {
				if(sequences.hasOwnProperty(key)) {
					changes.push(`${key} = NEXTVAL('${sequences[key]}')`)
				}
			}
		}

		const queryString = `UPDATE ${table} `
												+ `SET ${changes.join(', ')} `
												+ `WHERE ${queryKey} = $${c}`

		binds.push(queryValue)							
		
		await this.bindsQuery(rc, queryString, binds)
	}

	public async delete(rc : RunContextServer, table : string, queryKey : string, queryValue : any) {
		rc.isDebug() && rc.debug(rc.getName(this), `Deleting from ${table}, ${queryKey} : ${queryValue}.`)

		const queryString = `DELETE FROM ${table} WHERE ${queryKey} = $1`,
					binds       = [] as Array<any>

		binds.push(queryValue)			

		await this.bindsQuery(rc, queryString, binds)
  }

  public async mDelete(rc : RunContextServer, table : string, queryKey : string, queryValues : Array<any>) {
		rc.isDebug() && rc.debug(rc.getName(this), `Deleting from ${table}, ${queryKey} : ${queryValues}.`)
		
		const binds = [] as Array<any>

		let c 			 = 0,
				bindKeys = [] as Array<string>
				
		for(const qValue of queryValues) {
			bindKeys.push(`$${++c}`)
			binds.push(qValue)
		}		

		const queryString = `DELETE FROM ${table} WHERE ${queryKey} IN (${bindKeys.join(', ')})`

		await this.bindsQuery(rc, queryString, binds)
	}

/*------------------------------------------------------------------------------
	 PRIVATE METHODS
------------------------------------------------------------------------------*/
  
  private async bindsQuery(rc          : RunContextServer, 
                           queryString : string, 
                           binds       : Array<any>) : Promise<pg.QueryResult> {

    rc.isDebug() && rc.debug(rc.getName(this), 'bindsQuery executing', queryString, binds)
    
    if(!this.initialized) await this.init(rc)

    const client : pg.PoolClient = await this.clientPool.connect()

    try {
      const result = await new Promise<pg.QueryResult>((resolve, reject) => {
        client.query(queryString, binds, (err : Error, result : pg.QueryResult) => {
          err ? reject(err)
              : resolve(result)
        })
			})

			rc.isDebug() && rc.debug(rc.getName(this), 'bindsQuery executed', queryString, binds)

      return result
    } catch(e) {
      rc.isError() && rc.error(rc.getName(this), 'Error in executing query.', queryString, binds, e)
      throw new Mubble.uError(DB_ERROR_CODE, e.message)
    } finally {
      client.release()
    }
	}
}