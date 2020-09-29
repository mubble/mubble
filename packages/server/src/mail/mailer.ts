/*------------------------------------------------------------------------------
   About      : Mailer to send email based on Obopay's format
   
   Created on : Tue Apr 28 2020
   Author     : Vishal Sinha
   
   Copyright (c) 2020 Obopay Mobile Technologies Pvt Ltd. All rights reserved.
------------------------------------------------------------------------------*/

import { RunContextServer }   from '../rc-server'
import * as crypto            from 'crypto'
import * as nodemailer        from 'nodemailer'

import Mail         = require('nodemailer/lib/mailer')

const GMAIL_SERVICE = 'gmail',
      HEX           = 'hex'

export type SmtpConfig = {
  email    : string
  password : string
}

export type MailParts = {
  email             : string
  cc               ?: Array<string>
  subject           : string
  firstName        ?: string
  lastName         ?: string
  senderName        : string
  message           : string
  indyDisclaimer    : boolean
  headerImage      ?: {
    name : string
    path : string
  }
  attachments      ?: Array<MailAttachment>
}

export type MailAttachment = Mail.Attachment

export class Mailer {

  private transport    : Mail
  private senderEmail  : string

  constructor(rc : RunContextServer, config : SmtpConfig) {

    rc.isDebug() && rc.debug(rc.getName(this), 'Constructing Mailer object.', config.email)

    this.transport = nodemailer.createTransport({
      service : GMAIL_SERVICE,
      auth    : {
        user : config.email,
        pass : config.password
      }
    })

    this.senderEmail = config.email
  }

  public async sendEmail(rc : RunContextServer, emailParts : MailParts) {

    rc.isDebug() && rc.debug(rc.getName(this), 'Encoding email.', emailParts)

    const mailOptions = await this.encodeEmail(emailParts)

    rc.isDebug() && rc.debug(rc.getName(this), 'Sending email.', mailOptions)

    const resp = await this.transport.sendMail(mailOptions)

    rc.isDebug() && rc.debug(rc.getName(this), 'Email sent?', resp)
  }

/*------------------------------------------------------------------------------
  PRIVATE METHODS
------------------------------------------------------------------------------*/

  private encodeEmail(emailParts : MailParts) : Mail.Options {

    const imageId     = emailParts.headerImage ? this.getRandomId() : undefined,
          html        = this.composeHtml(emailParts.message, emailParts.senderName, emailParts.indyDisclaimer,
                                         emailParts.firstName, emailParts.lastName, imageId),
          attachments = emailParts.attachments || []

    if(emailParts.headerImage) {
      attachments.push({
        filename : emailParts.headerImage.name,
        path     : emailParts.headerImage.path,
        cid      : imageId
      })
    }

    const mailOptions : Mail.Options = {
      to      : emailParts.email,
      cc      : emailParts.cc,
      from    : this.senderEmail,
      subject : emailParts.subject,
      html,
      attachments
    }

    return mailOptions
  }

  private getRandomId() : string {
    const buff = crypto.randomBytes(15),
          hex  = buff.toString(HEX).slice(0, 30)

    return hex
  }

  private composeHtml(message         : string,
                      sender          : string,
                      indyDisclaimer  : boolean,
                      firstName      ?: string,
                      lastName       ?: string,
                      headerImageId  ?: string) : string {
      
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
${firstName || lastName ? `<p>Dear${firstName ? ` ${firstName}` : ''}${lastName ? ` ${lastName}` : ''},</p>` : ''}
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
</div>`

    return html
  }
}