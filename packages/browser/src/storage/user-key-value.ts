/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Sun Jun 25 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { RunContextBrowser }  from '../rc-browser'
import { StorageProvider }    from './storage-provider'
import { Mubble }             from '@mubble/core'

const LAST_USER     = 'lastUser'
export const USERS  = 'users'

export abstract class UserKeyValue {

  private _clientId               : number
  private _obopayId               : string
  private _sessionId              : string
  private _deviceId               : string

  //private _userLinkId             : string
  private _webProfilePicBase64    : string
  //userName                        : string
  screenVisitedStates             : { [compName: string] : boolean }

  private users         : {[key: string]: object} = {}
  private lastClientId  : number

  constructor(protected rc: RunContextBrowser, private storage: StorageProvider) {
  }

  async init() {

    const users = await this.storage.getUserKeyValue(this.rc, USERS)
    if (!users) return

    this.users = JSON.parse(users)
    const cid  = await this.storage.getUserKeyValue(this.rc, LAST_USER)
    this.lastClientId = Number(cid)

    if (!this.lastClientId) return
    this.deserialize(this.users[this.lastClientId])

    return this
  }

  async registerNewUser(clientId: number, userLinkId: string, userName: string) {

    const obj = { clientId, userLinkId, userName }
    this.users[clientId] = obj
    await this.storage.setUserKeyValue(this.rc, USERS, JSON.stringify(this.users))

    if (this.lastClientId !== clientId) {
      this.lastClientId = clientId
      await this.storage.setUserKeyValue(this.rc, LAST_USER, String(this.lastClientId))
    }

    this.deserialize(obj)
  }


  setScreenVisited(routeName: string) {

    if (!this.screenVisitedStates) this.screenVisitedStates = {}
    if (this.screenVisitedStates[routeName]) return
    this.screenVisitedStates[routeName] = true
    this.rc.isStatus() && this.rc.status(this.rc.getName(this), 'visited screen', routeName)
    this.save(this.rc)
  }


  setWebProfilePicBase64(rc: RunContextBrowser, base64: string) {
    this._webProfilePicBase64 = base64
    this.save(rc)
  }

  async logOutCurrentUser() {

    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), this._sessionId, 
      'Trying to logout a user who is not registered')

    delete this.users[this._clientId]
    await this.storage.setUserKeyValue(this.rc, USERS, JSON.stringify(this.users))
    
    if (Object.keys(this.users).length > 0) {
      const lastClientId = Number(Object.keys(this.users)[0])
      await this.switchUserOnCurrRun(lastClientId)
    } else {
      await this.storage.setUserKeyValue(this.rc, LAST_USER, null)
    }
  }

  async switchUserOnCurrRun(clientId: number) {
    this.lastClientId = clientId
    await this.storage.setUserKeyValue(this.rc, LAST_USER, String(this.lastClientId))
    this.deserialize(this.users[this.lastClientId])
  }

  async save(rc: RunContextBrowser) {

    rc.isAssert() && rc.assert(rc.getName(this), this._clientId, 
      'Came to save userKeyVal before clientId')

    if (!rc.userKeyVal.sessionId) {
      rc.isStatus() && rc.status(rc.getName(this), `not saving rc, as user 
        session not present ${JSON.stringify({sessionId : rc.userKeyVal.sessionId})}`)
      return
    }
    
    rc.isDebug() && rc.debug(rc.getName(this), `saving rc obj ${rc}`)

    this.users[this._clientId] = this.serialize()
    await this.storage.setUserKeyValue(this.rc, USERS, JSON.stringify(this.users))

    if (this.lastClientId !== this._clientId) {
      this.lastClientId = this._clientId
      await this.storage.setUserKeyValue(this.rc, LAST_USER, String(this.lastClientId))
    }
  }

  getWebProfilePicBase64(clientId: number): string {
    return this.users[clientId]['webProfilePicBase64']
  }

  getAllClientIds(): number[] { return Object.keys(this.users).map(Number) }

  getUserInfo(clientId: number): object { return this.users[clientId] }

  // Client Id
  get clientId() {return this._clientId}
  set clientId(clientId : number) {
    if (clientId === this._clientId) return
    if (this._clientId && this._sessionId) {
      throw new Mubble.uError('INVALID_CLIENT_ID', 'Cannot change clientId once sessionId is set: ' + 
        JSON.stringify({new:clientId, existing:this._clientId, sessionId: this._sessionId}))
    }
    this._clientId = clientId
  }

  get sessionId() { return this._sessionId }
  set sessionId(sessionId: string) {
    if (sessionId === this._sessionId) return
    this._sessionId = sessionId
  }

  get deviceId() { return this._deviceId }
  set deviceId(deviceId: string) {
    if (deviceId === this._deviceId) return
    this._deviceId = deviceId
  }

  get obopayId() { return this._obopayId }
  set obopayId(obopayId: string) {
    if (obopayId === this._obopayId) return
    if (this._obopayId && !obopayId === null) throw new Mubble.uError('INVALID_OBOPAY_ID', 
      'Cannot set obopayId when it is already set: ' + JSON.stringify({obopayId, existing:this._obopayId }))
    this._obopayId = obopayId
  }

  // // User Link Id
  // get userLinkId()  {return this._userLinkId}
  // set userLinkId(userLinkId : string) {
  //   if (userLinkId === this._userLinkId) return
  //   if (this._userLinkId && !userLinkId === null) throw new Mubble.uError('INVALID_USER_LINK_ID', 
  //     'Cannot set userLinkId when it is already set: ' + JSON.stringify({userLinkId, existing:this._userLinkId}))
  //   this._userLinkId = userLinkId
  // }

  serialize(): object {
    return {
      clientId            : this._clientId,
      sessionId           : this._sessionId,
      
      //userLinkId          : this._userLinkId,
      //userName            : this.userName,
      webProfilePicBase64 : this._webProfilePicBase64,
      screenVisitedStates : this.screenVisitedStates
    }
  }

  deserialize(obj: {[key: string]: any}) {
    this._clientId              = obj.clientId
    //this._userLinkId            = obj.userLinkId
    //this.userName               = obj.userName
    this._webProfilePicBase64   = obj.webProfilePicBase64
    this.screenVisitedStates    = obj.screenVisitedStates
  }

  $dump() {
    const keys = Object.getOwnPropertyNames(this)

    for (const key of keys) {
      console.info(`${key}=${JSON.stringify(this[key])}`)
    }
  }
  
}