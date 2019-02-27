/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Sun Jun 25 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { RunContextBrowser } from '../rc-browser'
import { StorageProvider } from '.'

const LAST_USER = 'lastUser'
const USERS     = 'users'

export abstract class UserKeyValue {

  private _clientId               : number
  private _userLinkId             : string
  private _webProfilePicBase64    : string
  userName                        : string
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

  async logOutCurrentUser(): Promise<string> {

    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), this._userLinkId, 
      'Trying to logout a user who is not registered')

    const userLinkId = this._userLinkId
    
    delete this.users[this._clientId]
    await this.storage.setUserKeyValue(this.rc, USERS, JSON.stringify(this.users))
    
    if (Object.keys(this.users).length > 0) {
      const lastClientId = Number(Object.keys(this.users)[0])
      await this.switchUserOnCurrRun(lastClientId)
    } else {
      await this.storage.setUserKeyValue(this.rc, LAST_USER, null)
    }
 
    return userLinkId
  }

  async switchUserOnCurrRun(clientId: number) {
    this.lastClientId = clientId
    await this.storage.setUserKeyValue(this.rc, LAST_USER, String(this.lastClientId))
    this.deserialize(this.users[this.lastClientId])
  }

  async save(rc: RunContextBrowser) {

    rc.isAssert() && rc.assert(rc.getName(this), this._clientId, 
      'Came to save userKeyVal before clientId')

    rc.isDebug() && rc.debug(rc.getName(this), `saving rc obj ${rc}`)

    if (!rc.userKeyVal.userLinkId) {

      rc.isStatus() && rc.status(rc.getName(this), `not saving rc, as user is 
        not registered ${JSON.stringify({userLinkId : rc.userKeyVal.userLinkId})}`)
      return
    }
    
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

  getAllUserLinkIds(): string[] { 

    const ids = []
    for (const i of Object.keys(this.users)) {
      ids.push(this.users[i]['userLinkId'])
    }
    return ids
  }

  getClientIdForUserLink(reqUserLinkId: string): number {

    for (let clientId in this.users) {
      const userLinkId: string = this.users[clientId]['userLinkId']
      if (userLinkId === reqUserLinkId) return Number(clientId)
    }
    return 0
  }

  getUserInfo(clientId: number): object { return this.users[clientId] }

  // Client Id
  get clientId() {return this._clientId}
  set clientId(clientId : number) {
    if (clientId === this._clientId) return
    if (this._clientId && this._userLinkId) {
      throw('Cannot change clientId once userLinkId is already set: ' + 
        JSON.stringify({new:clientId, existing:this._clientId, userLinkId: this._userLinkId}))
    }
    this._clientId = clientId
  }

  // User Link Id
  get userLinkId()  {return this._userLinkId}
  set userLinkId(userLinkId : string) {
    if (userLinkId === this._userLinkId) return
    if (this._userLinkId && !userLinkId === null) throw('Cannot set userLinkId when it is already set: ' + 
                        JSON.stringify({userLinkId, existing:this._userLinkId}))
    this._userLinkId = userLinkId
  }

  serialize(): object {
    return {
      clientId            : this._clientId,
      userLinkId          : this._userLinkId,
      userName            : this.userName,
      webProfilePicBase64 : this._webProfilePicBase64,
      screenVisitedStates : this.screenVisitedStates
    }
  }

  deserialize(obj: {[key: string]: any}) {
    this._clientId              = obj.clientId
    this._userLinkId            = obj.userLinkId
    this.userName               = obj.userName
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