/*------------------------------------------------------------------------------
   About      : Mailer to send email based on Obopay's format
   
   Created on : Tue Apr 28 2020
   Author     : Vishal Sinha
   
   Copyright (c) 2020 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import { HttpsRequest }       from '../util'
import { RunContextServer }   from '../rc-server'
import { HTTP }               from '@mubble/core'
import * as crypto            from 'crypto'
import * as urlModule         from 'url'
import * as http              from 'http'

import MailComposer = require('nodemailer/lib/mail-composer')
import Mail         = require('nodemailer/lib/mailer')

const HOSTNAME = 'www.googleapis.com',
      PORT     = 443,
      PATHNAME = '/gmail/v1/users/me/messages/send',
      BASE64   = 'base64',
      HEX      = 'hex'

export type MailParts = {
  email             : string
  subject           : string
  firstName         : string
  lastName          : string
  senderName        : string
  message           : string
  indyDisclaimer    : boolean
  obopayDisclaimer  : boolean
  headerImage      ?: {
    name : string
    path : string
  }
  attachments      ?: Array<MailAttachment>
}

export type MailAttachment = Mail.Attachment

export class Mailer {

  private httpsRequest : HttpsRequest
  private accessToken  : string
  private senderEmail  : string

  constructor(rc : RunContextServer, token : string, email : string, logsDir : string) {

    rc.isDebug() && rc.debug(rc.getName(this), 'Constructing Mailer object.', token, email, logsDir)
    this.httpsRequest = new HttpsRequest(rc, logsDir, HOSTNAME)
    this.accessToken  = token
    this.senderEmail  = email
  }

  public async sendEmail(rc : RunContextServer, emailParts : MailParts) {

    rc.isDebug() && rc.debug(rc.getName(this), 'Encoding email.', emailParts)

    const email = await this.encodeEmail(emailParts)

    rc.isDebug() && rc.debug(rc.getName(this), 'Sending email.', email)

    const urlObj : urlModule.UrlObject = {
      protocol : HTTP.Const.protocolHttps,
      hostname : HOSTNAME,
      port     : PORT,
      pathname : PATHNAME
    }

    const options : http.RequestOptions = {
      method  : HTTP.Method.POST,
      headers : {
        [HTTP.HeaderKey.authorization] : `Bearer ${this.accessToken}`,
        [HTTP.HeaderKey.contentType]   : HTTP.HeaderValue.json
      }
    }

    const data = { raw : email }

    rc.isDebug() && rc.debug(rc.getName(this), 'Making https request.', urlObj, options, data)

    const resp = await this.httpsRequest.executeRequest(rc, urlObj, options, data)

    rc.isDebug() && rc.debug(rc.getName(this), 'Email sent?', resp)
  }

/*------------------------------------------------------------------------------
  PRIVATE METHODS
------------------------------------------------------------------------------*/

  private async encodeEmail(emailParts : MailParts) : Promise<string> {

    const imageId     = emailParts.headerImage ? this.getRandomId() : undefined,
          html        = this.composeHtml(emailParts.firstName, emailParts.lastName, emailParts.message,
                                         emailParts.senderName, emailParts.indyDisclaimer,
                                         emailParts.obopayDisclaimer, imageId),
          attachments = emailParts.attachments || []

    if(emailParts.headerImage) {
      attachments.push({
        filename : emailParts.headerImage.name,
        path     : emailParts.headerImage.path,
        cid      : imageId
      })
    }

    const mailComposer = new MailComposer({
      to      : emailParts.email,
      from    : this.senderEmail,
      subject : emailParts.subject,
      html,
      attachments
    })

    const mimeNode = mailComposer.compile(),
          msgBuff  = await mimeNode.build(),
          email    = msgBuff.toString(BASE64)
                     .replace(/\+/g, '-')
                     .replace(/\//g, '_')
                     .replace(/=+$/, '')

    return email
  }

  private getRandomId() : string {
    const buff = crypto.randomBytes(15),
          hex  = buff.toString(HEX).slice(0, 30)

    return hex
  }

  private composeHtml(firstName         : string,
                      lastName          : string,
                      message           : string,
                      sender            : string,
                      indyDisclaimer    : boolean,
                      obopayDisclaimer  : boolean,
                      headerImageId    ?: string) : string {
      
  const html =
`<div dir="ltr">
  <br></br>
  <div class="gmail_quote">
    <br></br>
    <div bgcolor="#acacac" link="#79B73A" vlink="#79B73A" alink="#79B73A">
    ${headerImageId ? `
<table width="634" border="0" cellspacing="0" cellpadding="0" align="center">
  <tbody>
    <tr>
      <td width="17" background="http://images/left_shadow.gif"></td>
      <td width="600"><img src="cid:${headerImageId}" width="600" border="0"></td>
      <td width="17" background="http://images/right_shadow.gif"></td>
    </tr>
  </tbody>
</table>` : ''}
      <table width="634" border="0" cellspacing="0" cellpadding="0" align="center">
        <tbody>
          <tr>
            <td width="17" background="http://images/left_shadow.gif"></td>
            <td width="600" bgcolor="#FFFFFF">
              <table width="500" border="0" align="center" cellpadding="0" cellspacing="0">
                <tbody>
                  <tr>
                    <td align="left" valign="top" bgcolor="#FFFFFF">
                      <p></p>
                      <font size="2" face="Verdana, Arial, Helvetica, sans-serif">
                        <p>Dear ${firstName} ${lastName},</p>
                        <p>${message}</p>
                        <p>Regards,</p>
                        <p>${sender}</p>
                      </font>
                      ${indyDisclaimer ? `
<font face="Arial, Helvetica, sans-serif" size="1" color="#999999">
  <p>
    indyFint logo is a registered trademark of indyFint Pvt Ltd. Copyright @ 2015-2019 indyFint
    Pvt Ltd. All rights reserved. We respect your privacy and are absolutely committed to
    protection of the information provided by you. To know more about how we protect your data,
    please visit
    <a href="https://www.indyFint.com/privacy-policy/">https://www.indyFint.com/privacy-policy/</a>
    .
  </p>
</font>` : ''}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
            <td width="17" background="http://images/right_shadow.gif"></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</div>
${obopayDisclaimer ? `
<br></br>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:1.3em">
  </div=>
    <hr></hr>
    <p>
      <font color="#808080">
        Disclaimer : The information and any attachments contained in this message may be privileged and confidential
        and protected from disclosure or unauthorized use. If the reader of this message is not the intended
        recipient, you are hereby notified that any dissemination, distribution or copying of this communication is
        prohibited. If you have received this communication in error, please notify us immediately by replying to this
        message and then delete it. All email sent to this address will be received by Obopay Mobile Technology India
        Pvt Ltd and may be archived or reviewed.  Obopay Mobile Technology India Pvt Ltd accepts no liability for any
        loss or damage arising from this email, any virus transmitted, or its attachments.
      </font>
    </p>
  </div>
</div>` : ''}`

    return html
  }
}