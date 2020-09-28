/*------------------------------------------------------------------------------
   About      : Base Table for Big Query Storage
   
   Created on : Thu Feb 20 2020
   Author     : Siddharth Garg
   
   Copyright (c) 2020 Obopay. All rights reserved.
------------------------------------------------------------------------------*/

import * as lo                        from 'lodash'  
import { RunContextServer }           from '../../rc-server'
import { BigQueryClient }             from './bigquery-client'
import { Dataset, 
         Table,
         InsertRowsOptions
       }                              from '@google-cloud/bigquery'
import { BqRegistryManager, 
         BigqueryRegistry
       }                              from './bigquery-registry'

export type TABLE_CREATE_OPTIONS = {schema                  : any,
                                    timePartitioning       ?: any,
                                    requirePartitionFilter ?: boolean }

export function CheckUndefined(obj : any , nestingLevel : number = 2) {
  if(nestingLevel === 0) return
  lo.keysIn(obj).forEach((key: string)=>{
    if(obj[key]===undefined) obj[key] = null
    else if(typeof (obj[key]) === 'object') CheckUndefined(obj[key] , (nestingLevel - 1))
  })
}

export abstract class BqBaseModel {

  public abstract fieldsError(rc : RunContextServer) : string | null

  public static DATE_FORMAT = '%yyyy%%mm%%dd%'
  
  private options : TABLE_CREATE_OPTIONS

  private insertOptions : InsertRowsOptions

  public constructor(rc : RunContextServer) {}

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

  getTableName(rc : RunContextServer): string {
  
    const registry = BqRegistryManager.getRegistry((this as any).constructor.name.toLowerCase())    

    const verStr    = registry.getVersion() ? ('v'+ registry.getVersion()).replace(/\./gi,'') : '',  //v01
          tableName = `${registry.getTableName()}${verStr ? '_' + verStr : ''}`
  
    return tableName.replace(/\./gi, '_')       
  }

  getDatasetName(rc : RunContextServer): string {
    const registry = BqRegistryManager.getRegistry((this as any).constructor.name.toLowerCase())    
    return registry.getDataset()
  }

  public async tableExists(rc : RunContextServer): Promise<boolean> {

    const registry = BqRegistryManager.getRegistry((this as any).constructor.name.toLowerCase())    

    const dataset   : any    = await BigQueryClient._bigQuery.dataset(registry.getDataset()),
          tableName : string = this.getTableName(rc) ,
          table     : any    = dataset.table(tableName),
          tableRes  : any    = await table.exists()
   
    return !!tableRes[0]
  }

  public getTableOptions(rc : RunContextServer) : TABLE_CREATE_OPTIONS {

    if (!this.options) {

      const registry = BqRegistryManager.getRegistry((this as any).constructor.name.toLowerCase())    
      rc.isAssert() && rc.assert(rc.getName(this), registry.getFields().length > 0, 'Fields are empty')
  
      const fields       = registry.getFields().filter((field) => field.parent === undefined),
            recordFields = registry.getFields().filter((field) => field.parent !== undefined)
  
      // Supproting 2 levels of record
      for (const recField of recordFields) {
        let parentField = fields.find((fld) => fld.name === recField.parent)
        if (!parentField) parentField = recordFields.find((fld) => fld.name === recField.parent)

        if (!parentField!!.fields) parentField!!.fields = []
        parentField!!.fields.push(recField)
      }

      if (registry.isPartition()) {
        this.options = {
          "schema"    : {
            "fields"  : fields
          },
          "timePartitioning" : {
            "type"    : registry.getOptions()!.timePartitioning!.type,
            "field"   : registry.getOptions()!.timePartitioning!.field
          },
          "requirePartitionFilter": registry.getOptions()!.requirePartitionFilter!
        }
      } else {
        this.options = {
          "schema" : {
            "fields" : fields
          }
        }
      }
    }

    return this.options
  }

  public getTableInsertOptions(rc : RunContextServer) : InsertRowsOptions {
    if (!this.insertOptions) {
      this.insertOptions = {
        "raw" : true
      }
    }
    return this.insertOptions
  }

  public async init(rc : RunContextServer) {
    
    const registry = BqRegistryManager.getRegistry((this as any).constructor.name.toLowerCase())    

    rc.isDebug() && rc.debug(rc.getName(this), 'init')
    
    rc.isAssert() && rc.assert(rc.getName(this), 
        !lo.isEmpty(registry.getDataset()) && 
        !lo.isEmpty(registry.getTableName()) && 
        !lo.isEmpty(this.getTableOptions(rc)) , 'Table properties not set' )

    const dataset   : Dataset  = await this.getDataset(rc, registry)
    
    const tableName : string  = this.getTableName(rc) ,
          table     : Table   = dataset.table(tableName),
          tableRes  : any     = await table.exists()
    
    if(tableRes[0]) {
      /*
      // Table metadata
      const metadata  : any = await table.getMetadata(),
            oldSchema : any = lo.cloneDeep(metadata[0].schema) ,
            oldFields : any[] = oldSchema.fields || []
      // remove describe fields for the sake of comparison
      for(const field of oldFields){
        delete field.description
      }      
      if(lo.isEqual( oldSchema , this.getTableOptions(rc).schema ) ) {
        rc.isDebug() && rc.debug(rc.getName(this), 'Table [ Version ' + registry.getVersion() + ' ] exists with correct schema')
        return
      }
      rc.isError() && rc.error(rc.getName(this), 'Table [ Version ' + registry.getVersion() + ' ] schema is changed. old schema ',JSON.stringify(metadata[0].schema) )
      rc.isError() && rc.error(rc.getName(this), 'Table [ Version ' + registry.getVersion() + ' ] schema is changed. new schema ',JSON.stringify(this.getTableOptions(rc).schema))
      
      throw new Error(registry.getTableName() +' Table [ Version ' + registry.getVersion() + ' ] schema changed . Change Version'+this.getTableOptions(rc) + '' + oldSchema)
      
      // Table schema is changed. Delete the old table and create new
      rc.isWarn() && rc.warn(rc.getName(this), 'Table schema is changed. old schema ',JSON.stringify(metadata[0].schema) )
      rc.isWarn() && rc.warn(rc.getName(this), 'Table schema is changed. new schema ',JSON.stringify(this.options.table_options.schema))
      
      await this.takeTableBackup(rc, tableName , metadata[0].schema)
      // Todo : fix this . Why this is necessary ?
      await new Promise((resolve , reject)=>{setTimeout(resolve() , 4000)}) // wait for some time
      await table.delete()
      await new Promise((resolve , reject)=>{setTimeout(resolve() , 4000)}) // wait for some time
      */
    } else {
      rc.isDebug() && rc.debug(rc.getName(this), 'creating the new BQ table', tableName)
      // create new table . First time or after dropping the old schema
      const res = await dataset.createTable(tableName , this.getTableOptions(rc))
      rc.isDebug && rc.debug(rc.getName(this), 'bigQuery table result', 
          JSON.stringify( res[1].schema) , res[1].timePartitioning)  
    }
  
  }

  public async getDataStoreTable(rc : RunContextServer) {

    const registry = BqRegistryManager.getRegistry((this as any).constructor.name.toLowerCase())    

    const dataset       : Dataset              = BigQueryClient._bigQuery.dataset(registry.getDataset()),
          tableName     : string               = this.getTableName(rc) ,
          table         : any                  = dataset.table(tableName)
   
    rc.isDebug() && rc.debug(rc.getName(this), (this as any).name , ' insert data to table',tableName, '[ Version ' + registry.getVersion() + ']')
    return table
  }

  async insert(rc : RunContextServer) {
    
    let err = this.fieldsError(rc)  
    if(err) {
      rc.isWarn() && rc.warn(rc.getName(this), 'Data Sanity Failed. Not inserting the model.',err)
      return
    }  
      
    const clazz   = this.constructor as any,
          traceId = clazz.name + ':' + 'BqInsert:' + Date.now(),
          ack     = rc.startTraceSpan(traceId)

    try {
      const table    : Table = await clazz.getDataStoreTable(rc),
            bqNiData = this

      rc.isDebug() && rc.debug(rc.getName(this), 'data : ',bqNiData)
      const res = await table.insert(bqNiData, this.getTableInsertOptions(rc))
      rc.isDebug() && rc.debug(rc.getName(this), 'data insertion success')
      
    } catch(err) {
      rc.isError() && rc.error(rc.getName(this), err)
      throw err
    } finally {
      rc.endTraceSpan(traceId,ack)
    }
  }

  async streamBulkInsert<T extends BQInsertObject>(rc : RunContextServer, items : T[]) {
  
    const registry = BqRegistryManager.getRegistry((this as any).constructor.name.toLowerCase())    

    for(const item of items) {
      // check the fields sanity of all items
      const str=item.json.fieldsError(rc)
      if(str){
        rc.isError() && rc.error(rc.getName(this), 'data sanity check failed for item',item , registry.getTableName())
        throw new Error('Data Sanity Failure' + item + registry.getTableName())
      }
    }
  
    const table: Table = await this.getDataStoreTable(rc)

    rc.isDebug() && rc.debug(rc.getName(this), 'streamBulkInsert ', registry.getTableName(), items.length)
    try {
      const res = await table.insert(items, this.getTableInsertOptions(rc))
    } catch (error) {
      rc.isError() && rc.error(rc.getName(this), 'streamBulkInsert Failure ', registry.getTableName(), error)
      let errorRowCount : number = 0
      if (error && error.name === 'PartialFailureError') {
        rc.isError() && rc.error(rc.getName(this), 'streamBulkInsert Failure: PartialFailureError for table ' + registry.getTableName() , error)
        rc.isError() && rc.error(rc.getName(this), 'streamBulkInsert Failure: ------start-------')
        error.errors.forEach((element: any) => {
          errorRowCount++
          let errorDesc : string = ''
          element.errors.forEach((errorDescObject: any) => {
            errorDesc = JSON.stringify(errorDescObject) + ','
          })
          const errorMessage = `row: ${JSON.stringify(element.row)} failed due to ${errorDesc}`
          rc.isError() && rc.error(rc.getName(this), 'Errors ', errorMessage)

        })
        rc.isError() && rc.error(rc.getName(this), 'streamBulkInsert Failure: ------end-------')
      } else {
        //todo handle other error scenarios
      }
      rc.isError() && rc.error(rc.getName(this), `streamBulkInsert success records:${items.length - errorRowCount}, failed records ${errorRowCount}`)
      // throw new Error('Data Insert Failure for ' + registry.getTableName())
      throw error
    }
    rc.isDebug() && rc.debug(rc.getName(this), 'streamBulkInsert Successful')
  }

  async streamInsert(rc : RunContextServer) {
    
    let err = this.fieldsError(rc)  
    if(err) {
      rc.isWarn() && rc.warn(rc.getName(this), 'Data Sanity Failed. Not inserting the model.',err)
      return
    }  
      
    const clazz   = this.constructor as any,
          traceId = clazz.name + ':' + 'streamInsert:' + Date.now(),
          ack     = rc.startTraceSpan(traceId)

    try {
      const table    : Table = await clazz.getDataStoreTable(rc),
            bqNiData = this

      rc.isDebug() && rc.debug(rc.getName(this), 'data : ',bqNiData)
      const res = await table.insert(bqNiData, this.getTableInsertOptions(rc))
      rc.isDebug() && rc.debug(rc.getName(this), 'data insertion success')
      
    } catch(err) {
      rc.isError() && rc.error(rc.getName(this), err)
      throw err
    } finally {
      rc.endTraceSpan(traceId,ack)
    }
  }

  static async getTableData (rc : RunContextServer, query: any, useLegacySql: boolean = false) {
  
    const options = {
      query : query,
      useLegacySql: useLegacySql // Use standard SQL syntax for queries.
    }
    const result = await BigQueryClient._bigQuery.query(options) 
    return result
  } 

  async bulkInsert<T extends BqBaseModel>(rc : RunContextServer, items : T[]) {
  
    const registry = BqRegistryManager.getRegistry((this as any).constructor.name.toLowerCase())    

    for(const item of items) {
      // check the fields sanity of all items
      const str=item.fieldsError(rc)
      if(str){
        rc.isError() && rc.error(rc.getName(this), 'data sanity check failed for item',item , registry.getTableName())
        throw new Error('Data Sanity Failure' + item + registry.getTableName())
      }
    }
  
    const table: any = await this.getDataStoreTable(rc)
    rc.isDebug() && rc.debug(rc.getName(this), 'bulkInsert ', registry.getTableName(), items.length)
    const res = await table.insert(items)
    rc.isDebug() && rc.debug(rc.getName(this), 'bulkInsert Successful')
  }

  static async listTables(rc : RunContextServer, dsName : string) {

    const traceId = `BqListTables:${Date.now()}`,
          ack     = rc.startTraceSpan(traceId)

    try {
      const dataset = BigQueryClient._bigQuery.dataset(dsName),
            data    = await dataset.getTables()

      rc.isDebug() && rc.debug(rc.getName(this), 'Table Listing Success')
      return data[0]
      
    } catch(err) {
      rc.isError() && rc.error(rc.getName(this), err)
      throw err
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
    
  }

  static async deleteTable(rc : RunContextServer, id : string, dsName : string) {

    const traceId = `BqDeleteTable:${Date.now()}`,
          ack     = rc.startTraceSpan(traceId)

    try {
      const dataset = BigQueryClient._bigQuery.dataset(dsName),
            table   = dataset.table(id)

      await table.delete()
      rc.isDebug() && rc.debug(rc.getName(this), 'Table Deletion Success :', id)
      
    } catch(err) {
      rc.isError() && rc.error(rc.getName(this), err)
      throw err
    } finally {
      rc.endTraceSpan(traceId, ack)
    }
  }

  async getDataset(rc: RunContextServer, registry: BigqueryRegistry): Promise<Dataset> {

    let dataset : Dataset = await BigQueryClient._bigQuery.dataset(registry.getDataset())

    if (!dataset.exists()) {
      rc.isDebug() && rc.debug(rc.getName(this), 'creating new Dataset', registry.getDataset)

      const options = {
        location: 'asia-south1',
      }
    
      // Create a new dataset
      const [createdDataset] = await BigQueryClient._bigQuery.createDataset(
        registry.getDataset(), options)
      dataset = createdDataset
    }

    return dataset
  }

}

export interface BQInsertObject {
  insertId : string,
  json     : any
}