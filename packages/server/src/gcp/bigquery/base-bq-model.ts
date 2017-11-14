/*------------------------------------------------------------------------------
   About      : Base Table for Big Query Storage
   
   Created on : Thu Jul 27 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as lo                      from 'lodash'  
import {format}                     from '@mubble/core'
import {RunContextServer}           from '../../rc-server'
import {BigQueryBase}               from './bigquery-base'

export type table_create_options = {schema : any }

export function CheckUndefined(obj : any , nestingLevel : number = 2) {
  if(nestingLevel === 0) return
  lo.keysIn(obj).forEach((key: string)=>{
    if(obj[key]===undefined) obj[key] = null
    else if(typeof (obj[key]) === 'object') CheckUndefined(obj[key] , (nestingLevel - 1))
  })
}

export type BigQueryTableOptions = {
  
  DATA_STORE_NAME : string ,
  _tableName      : string ,
  table_options   : table_create_options ,
  day_partition   : boolean
  version         : number 
}

export function getTableName(rc : RunContextServer , bqTableOptions : BigQueryTableOptions , dayStamp ?: string){
  
  const verStr    = ('v'+bqTableOptions.version).replace(/\./gi,''),  //v01
        tableName =  bqTableOptions.day_partition ?
         `${bqTableOptions._tableName}_${verStr}_${dayStamp || format(new Date(), BaseBigQuery.DATE_FORMAT)}`:
         `${bqTableOptions._tableName}_${verStr}`

  return tableName.replace(/\./gi,'_')       
}

export abstract class BaseBigQuery {
  
  public static DATE_FORMAT = '%yyyy%%mm%%dd%'
  
  public static NC_DATA_STORE : string = 'newschat'
  protected static today_table : string
  
  protected static options : BigQueryTableOptions

  public static async init(rc : RunContextServer) {
    
    rc.isDebug() && rc.debug(rc.getName(this), 'init')
    
    rc.isAssert() && rc.assert(rc.getName(this), 
    !lo.isEmpty(this.options) && 
    !lo.isEmpty(this.options._tableName) && 
    !lo.isEmpty(this.options.DATA_STORE_NAME) && 
    !lo.isEmpty(this.options.table_options) , 'Table properties not set' )

    const dataset  : any = await BigQueryBase._bigQuery.dataset(this.options.DATA_STORE_NAME),
          dsRes    : any = await dataset.get({autoCreate : true})
    
    const tableName : string = getTableName(rc , this.options) ,
          table     : any = dataset.table(tableName),
          tableRes  : any = await table.exists()
    
    this.today_table  = tableName
    if(tableRes[0]){
      
      // Table metadata
      const metadata  : any = await table.getMetadata(),
            oldSchema : any = lo.cloneDeep(metadata[0].schema) ,
            oldFields : any[] = oldSchema.fields || []
      // remove describe fields for the sake of comparison
      for(const field of oldFields){
        delete field.description
      }      
      if(lo.isEqual( oldSchema , this.options.table_options.schema ) ) {
        rc.isDebug() && rc.debug(rc.getName(this), 'Table [ Version ' + this.options.version + ' ] exists with correct schema')
        return
      }
      rc.isError() && rc.error(rc.getName(this), 'Table [ Version ' + this.options.version + ' ] schema is changed. old schema ',JSON.stringify(metadata[0].schema) )
      rc.isError() && rc.error(rc.getName(this), 'Table [ Version ' + this.options.version + ' ] schema is changed. new schema ',JSON.stringify(this.options.table_options.schema))
      
      throw new Error(this.options._tableName +' Table [ Version ' + this.options.version + ' ] schema changed . Change Version'+this.options + '' + oldSchema)
      /*
      // Table schema is changed. Delete the old table and create new
      rc.isWarn() && rc.warn(rc.getName(this), 'Table schema is changed. old schema ',JSON.stringify(metadata[0].schema) )
      rc.isWarn() && rc.warn(rc.getName(this), 'Table schema is changed. new schema ',JSON.stringify(this.options.table_options.schema))
      
      await this.takeTableBackup(rc, tableName , metadata[0].schema)
      // Todo : fix this . Why this is necessary ?
      await new Promise((resolve , reject)=>{setTimeout(resolve() , 4000)}) // wait for some time
      await table.delete()
      await new Promise((resolve , reject)=>{setTimeout(resolve() , 4000)}) // wait for some time
      */
    } 
    
    rc.isDebug() && rc.debug(rc.getName(this), 'creating the new BQ table', tableName)
    // create new table . First time or after dropping the old schema
    const res = await dataset.createTable(tableName , this.options.table_options)
    rc.isDebug && rc.debug(rc.getName(this), 'bigQuery table result', JSON.stringify( res[1].schema , res[1].timePartitioning))
  }

  private static async takeTableBackup(rc : RunContextServer , tableName : string , tableSchema : any) {
    
    const bigQuery : any = BigQueryBase._bigQuery ,
          overwrite = false ,
          backup_table_name : string = this.options._tableName + '_' + format(new Date() , '%yy%%mm%%dd%%hh%%nn%%ss%') 
    
    rc.isDebug() && rc.debug(rc.getName(this), 'takeTableBackup ',backup_table_name )
    
    const copyJob : any =  await new Promise((resolve, reject) => {
              bigQuery.request({
              method: 'POST',
              uri: '/jobs',
              json: {
                configuration: {
                  copy: {
                    destinationTable: {
                                    projectId : bigQuery.projectId, 
                                    datasetId: this.options.DATA_STORE_NAME,
                                    tableId: backup_table_name
                                  },
                    sourceTable : {
                      projectId : bigQuery.projectId , 
                      datasetId : this.options.DATA_STORE_NAME,
                      tableId   : tableName 
                    },
                    createDisposition: 'CREATE_IF_NEEDED',  
                    writeDisposition: overwrite ? 'WRITE_TRUNCATE' : 'WRITE_APPEND',
                    schema : tableSchema
                  },
                },
              },
            }, (err : any , resp : any) => {
              if (err) {
                return reject(err);
              }

              const job = bigQuery.job(resp.jobReference.jobId);
              job.metadata = resp;

              resolve(job);
            });
          });  
          
     await new Promise((resolve,reject)=>{
        copyJob.on('complete', function(metadata : any) {
          rc.isDebug() && rc.debug(rc.getName(this), 'copy finished',metadata)
          
          rc.isDebug() && rc.debug(rc.getName(this), 'copy finished',metadata.selfLink)

          resolve(metadata)
        })
        copyJob.on('error', function(err : any) {
          rc.isDebug() && rc.debug(rc.getName(this), 'copy error')
          reject(err)
        })
      })     
  }

  public constructor(){
  }

  protected copyConstruct(bqItem : any) {
    
    if(bqItem==null) return
    // copy all the DataStore Models Item fields to BaseBigQuery (which are present in own schema)
    let ownKeys : string[] = lo.keys(this) ,  // own keys
        bqItemClone : any = lo.pick(bqItem , ownKeys) // item clone with only own fields
    
    // change undefined values to null
    // Undefined is not accepted in BQ
    CheckUndefined(bqItemClone , 2)        
  
    // assign those all fields to self
    lo.assign(this , bqItemClone)
  }

  public fieldsError(rc : RunContextServer) : string | null {
    return null
  }

  public static async getDataStoreTable(rc : RunContextServer , day_timestamp ?: string) {
    
    const clazz : any                    = this as any ,
    options : BigQueryTableOptions       = clazz.options ,
    dataset : any                        = BigQueryBase._bigQuery.dataset(options.DATA_STORE_NAME),
    table_options : table_create_options = options.table_options,
    tableName     : string               = getTableName(rc , options , day_timestamp) ,
    table         : any                  = dataset.table(tableName)
  
    if(options.day_partition && clazz.today_table!== tableName){
      // check day partition table exists
      const tableRes : any = await table.exists()
      if(!tableRes[0]){
      // table does not exists. Create it
      const res = await dataset.createTable(tableName , table_options)
      }
      clazz.today_table = tableName
    }
    
    rc.isDebug() && rc.debug(rc.getName(this), clazz.name , ' insert data to table',tableName, '[ Version ' + options.version + ']')
    return table
  }

  async insert(rc : RunContextServer , day_timestamp ?: string) {
    let err = this.fieldsError(rc)  
    if(err) {
      rc.isWarn() && rc.warn(rc.getName(this), 'Data Sanity Failed. Not inserting the model.',err)
      return
    }  
      
    const clazz    = this.constructor as any,
          table    = await clazz.getDataStoreTable(rc , day_timestamp),
          bqNiData = this

    rc.isDebug() && rc.debug(rc.getName(this), 'data : ',bqNiData)

    const traceId = clazz.name + ':' + 'BqInsert',
          ack     = rc.startTraceSpan(traceId),
          res     = await table.insert(bqNiData)

    rc.endTraceSpan(traceId,ack)
  }

static async getTableData (rc : RunContextServer, query: any, useLegacySql:boolean) {
  const options = {
    query : query,
    useLegacySql: useLegacySql // Use standard SQL syntax for queries.
  }
  const result = await BigQueryBase._bigQuery.query(options) 
  return result
} 

static async bulkInsert(rc : RunContextServer , items : BaseBigQuery[] , day_timestamp ?: string) {
  
  for(const item of items){
    // check if all items are instance of this class
    if(!(item instanceof this)){
      rc.isError() && rc.error(rc.getName(this), 'item ',item , 'is not an instance of model',this.name)
      throw new Error('Bulk Insert Failure' + item + this.name)
    }
    // check the fields sanity of all items
    const str=item.fieldsError(rc)
    if(str){
      rc.isError() && rc.error(rc.getName(this), 'data sanity check failed for item',item , this.name)
      throw new Error('Data Sanity Failure' + item + this.name)
    }
  }

  const  table  : any = await this.getDataStoreTable(rc , day_timestamp)
  rc.isDebug() && rc.debug(rc.getName(this), 'bulkInsert ',this.name , items.length)
  const res  = await table.insert(items)
  rc.isDebug() && rc.debug(rc.getName(this), 'bulkInsert Successful')
}

// Job to Import data from the given path of the datastore backup
  async importJob(rc : RunContextServer, path : string) {
    const clazz    = this.constructor as any,
          table    = await clazz.getDataStoreTable(rc , Date.now()),
          metadata = {
            sourceFormat     : 'DATASTORE_BACKUP',
            writeDisposition : 'WRITE_TRUNCATE'
          }

    return table.import(path, metadata)
  }
}
