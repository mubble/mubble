/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Mon Jul 29 2019
   Author     : Siddharth Garg
   
   Copyright (c) 2019 Obopay. All rights reserved.
------------------------------------------------------------------------------*/
import * as nodemailer from 'nodemailer'

export async function sendGMail(userId: string, password: string, from: string, addresses: string[], 
                                subject: string, body: string) {

//console.log(`Test1`);

try {


  const transporter = await nodemailer.createTransport({
    host   : 'smtp.gmail.com',
    service: 'Gmail',
    auth   : {
      user : userId,
      pass : password 
    }
  })

  //console.log(`Test2`);
  
  if(addresses && addresses.length>0){
    const info = await transporter.sendMail({
      from    : from, // sender address
      to      : addresses.join(','), // list of receivers
      subject : subject, // Subject line
      html    : body, // plain text body
    })
  }
  //console.log(`Sent Email with messageId: ${info.messageId}`)

} catch (e) {
  throw e
}

}