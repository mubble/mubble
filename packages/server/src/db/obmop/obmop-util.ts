/*------------------------------------------------------------------------------
   About      : Obmop DB Utilities
   
   Created on : Fri Jun 14 2019
   Author     : Vishal Sinha
   
   Copyright (c) 2019 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

export const DB_ERROR_CODE = 'DB_ERR'

export const ObmopErrorMessage = {
  CONFIG_ERROR    : 'Invalid database config.',
  DELETED_ENTITY  : 'Trying to operate on a deleted entity.',
  UNKNOWN_INSERT  : 'Trying to insert an unknown field.',
  UNKNOWN_UPDATE  : 'Trying to update an unknown field.',
  PK_INSERT       : 'Trying to insert entity without primary key.',
  PK_UPDATE       : 'Trying to update primary key in an entity.',
  NOT_NULL_INSERT : 'Trying to insert entity with not null field as null or empty.',
  SERIAL_INSERT   : 'Trying to insert a serialized field.',
  SEQUENCE_INSERT : 'Trying to insert a sequence field.',
  SERIAL_UPDATE   : 'Trying to update a serialized field.',
  SEQUENCE_UPDATE : 'Trying to update a sequence field.'
}