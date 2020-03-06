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
import { 
				 ObmopBaseClient,
				 QueryRetval,
         QueryCondition,
         QueryRange,
         QuerySort
			 }      									from '../obmop-base'
import { RunContextServer }  	 	from '../../../rc-server'
import { DB_ERROR_CODE }        from '../obmop-util'
import * as pg                  from 'pg'
import * as stream              from 'stream'
import { resolve } from 'dns'

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
  
  public async query(rc      : RunContextServer,
                     table   : string,
                     fields  : Array<string>,
                     query  ?: QueryCondition,
                     limit   : number = -1,
                     offset  : number = 0,
                     range  ?: QueryRange,
                     sort   ?: QuerySort) : Promise<QueryRetval> {  

    rc.isDebug() && rc.debug(rc.getName(this), 'Fetching from table', table) 

    
		let c = query ? query.binds.length : 0

		const fieldString = fields.join(', '),
					binds       = query ? query.binds : [] as Array<any>,
					addQuery    = query ? range ? ` WHERE ${query.queryStr} AND`
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
										+ `SELECT COUNT(*) OVER() AS TOTCOUNT, T1.*` 
										+ `FROM ${table} T1`
										+ addQuery
										+ addRange
										+ addSort
										+ `) OFFSET :${++c} ROWS FETCH NEXT :${++c} ROWS ONLY`

			binds.push(`${offset}`)
			binds.push(`${limit}`)						 				
		}
    
    const result = await this.bindsQuery(rc, queryString, binds)

    return {
      entities : result.rows,
      totalCount : result.rows.length
    }      
  }

	public async insert(rc 				 : RunContextServer, 
											table 		 : string, 
											entity 		 : Mubble.uObject<any>,
											sequences ?: Mubble.uObject<string>) {

		rc.isDebug() && rc.debug(rc.getName(this), 'Inserting into table, ' + table + '.', entity)

		const keys     = Object.keys(entity),
					bindKeys = [] as Array<string>,
					binds    = [] as Array<any>

		for(const key of keys) {
			bindKeys.push(`:${key}`)
		}			

		if(sequences) {
			const sequenceKeys : Array<string> = Object.keys(sequences),
						sequenceVals : Array<string> = Object.values(sequences)

			keys.push(...sequenceKeys)
			bindKeys.push(...sequenceVals.map(sequenceName => `${sequenceName}.NEXTVAL`))			
		}

		const bind : any = {}
		
		for(const key in entity) {
			if(entity.hasOwnProperty(key)) {
				bind[key] = entity[key]
			}
		}
		binds.push(bind)

		const queryString = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${bindKeys.join(', ')})`

		await this.bindsQuery(rc, queryString, binds)
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
			for(const key in sequences) {
				if(sequences.hasOwnProperty(key)) {
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
			bindKeys.push(`:${++c}`)
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

    rc.isDebug() && rc.debug(rc.getName(this), 'bindsQuery', queryString, binds)
    
    if(!this.initialized) await this.init(rc)

    const client : pg.PoolClient = await this.clientPool.connect()

    try {
      const result = await new Promise<pg.QueryResult>((resolve, reject) => {
        client.query(queryString, binds, (err : Error, result : pg.QueryResult) => {
          err ? reject(err)
              : resolve(result)
        })
      })

      return result
    } catch(e) {
      rc.isError() && rc.error(rc.getName(this), 'Error in executing query.', queryString, binds, e)
      throw new Mubble.uError(DB_ERROR_CODE, e.message)
    } finally {
      client.release()
    }
	}
}