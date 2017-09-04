/*------------------------------------------------------------------------------
   About      : Base Table for Big Query Storage
   
   Created on : Thu Jul 27 2017
   Author     : Gaurav Kulshreshtha
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as lo                      from 'lodash'  
import {format}                     from '@mubble/core'
import {RunContextServer}           from '../../rc-server'

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
  
  const verStr = ('v'+bqTableOptions.version).replace(/\./gi,''),  //v01
        tablename =  bqTableOptions.day_partition ?
         `${bqTableOptions._tableName}_${verStr}_${dayStamp || format(new Date(), '%yyyy%%mm%%dd%')}`:
         `${bqTableOptions._tableName}_${verStr}`

  return tablename.replace(/\./gi,'_')       
}

export abstract class BaseBigQuery {
  
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

    const dataset  : any = await rc.gcloudEnv.bigQuery.dataset(this.options.DATA_STORE_NAME),
          dsRes    : any = await dataset.get({autoCreate : true})
    
    const tablename : string = getTableName(rc , this.options) ,
          table    : any = dataset.table(tablename),
          tableRes : any = await table.exists()
    
    this.today_table  = tablename
    if(tableRes[0]){
      
      // Table metadata
      const metadata : any = await table.getMetadata()
      if(lo.isEqual( metadata[0].schema , this.options.table_options.schema ) ) {
        rc.isDebug() && rc.debug(rc.getName(this), 'Table exists with correct schema')
        return
      }
      throw new Error('Table schema changed . Change Version'+this.options)
      /*
      // Table schema is changed. Delete the old table and create new
      rc.isWarn() && rc.warn(rc.getName(this), 'Table schema is changed. old schema ',JSON.stringify(metadata[0].schema) )
      rc.isWarn() && rc.warn(rc.getName(this), 'Table schema is changed. new schema ',JSON.stringify(this.options.table_options.schema))
      
      await this.takeTableBackup(rc, tablename , metadata[0].schema)
      // Todo : fix this . Why this is necessary ?
      await new Promise((resolve , reject)=>{setTimeout(resolve() , 4000)}) // wait for some time
      await table.delete()
      await new Promise((resolve , reject)=>{setTimeout(resolve() , 4000)}) // wait for some time
      */
    } 
    
    rc.isDebug() && rc.debug(rc.getName(this), 'creating the new BQ table', tablename)
    // create new table . First time or after dropping the old schema
    const res = await dataset.createTable(tablename , this.options.table_options)
    rc.isDebug && rc.debug(rc.getName(this), 'bigquery table result', JSON.stringify( res[1].schema , res[1].timePartitioning))
  }

  private static async takeTableBackup(rc : RunContextServer , tablename : string , tableSchema : any) {
    
    const bigQuery : any = rc.gcloudEnv.bigQuery ,
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
                      datasetId: this.options.DATA_STORE_NAME,
                      tableId: tablename 
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

  async insert(rc : RunContextServer , day_timestamp ?: string) {
    
  const clazz : any = this.constructor as any ,
        options : BigQueryTableOptions = clazz.options ,
        dataset : any = rc.gcloudEnv.bigQuery.dataset(options.DATA_STORE_NAME),
        table_options : table_create_options = options.table_options,
        tablename : string = getTableName(rc , options , day_timestamp) ,
        table  : any = dataset.table(tablename)
  
  if(options.day_partition && clazz.today_table!== tablename){
    // check day partition table exists
    const tableRes : any = await table.exists()
    if(!tableRes[0]){
      // table doesnot exists. Create it
      const res = await dataset.createTable(tablename , table_options)
    }
    clazz.today_table = tablename
  }

  const bqNiData = this
  rc.isDebug() && rc.debug(rc.getName(this), clazz.name , ' insert data', bqNiData , 'to table',tablename)
  
  const res  = await table.insert(bqNiData)
}

  
}
