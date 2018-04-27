/*------------------------------------------------------------------------------
   About      : <Write about the file here>
   
   Created on : Sun Jun 25 2017
   Author     : Raghvendra Varma
   
   Copyright (c) 2017 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import { RunContextBrowser } from '../rc-browser'

const LAST_USER = 'lastUser'
const USERS     = 'users'

export abstract class UserKeyValue {

  private _clientId               : number
  private _userLinkId             : string
  private _webProfilePicBase64    : string
  userName                        : string

  private users         : {[key: string]: object} = {}
  private lastClientId  : number

  constructor(private rc: RunContextBrowser) {

    const users = localStorage.getItem(USERS)
    if (!users) return

    this.users = JSON.parse(users)
    this.lastClientId = Number(localStorage.getItem(LAST_USER))

    if (!this.lastClientId) return
    this.deserialize(this.users[this.lastClientId])
  }

  registerNewUser(rc: RunContextBrowser, clientId: number, 
    userLinkId: string, userName: string) {

    const obj = { clientId, userLinkId, userName }
    this.users[clientId] = obj
    localStorage.setItem(USERS, JSON.stringify(this.users))

    if (this.lastClientId !== clientId) {
      this.lastClientId = clientId
      localStorage.setItem(LAST_USER, String(this.lastClientId))
    }

    this.deserialize(obj)
  }

  setWebProfilePicBase64(rc: RunContextBrowser, base64: string) {
    this._webProfilePicBase64 = base64
    this.save(rc)
  }

  logOutCurrentUser(): string {

    this.rc.isAssert() && this.rc.assert(this.rc.getName(this), this._userLinkId, 
      'Trying to logout a user who is not registered')

    const userLinkId = this._userLinkId
    
    delete this.users[this._clientId]
    localStorage.setItem(USERS, JSON.stringify(this.users))
    
    if (Object.keys(this.users).length > 0) {
      const lastClientId = Number(Object.keys(this.users)[0])
      this.switchUserOnCurrRun(lastClientId)
    } else {
      localStorage.setItem(LAST_USER, null)
    }

    return userLinkId
  }

  switchUserOnCurrRun(clientId: number) {
    this.lastClientId = clientId
    localStorage.setItem(LAST_USER, String(this.lastClientId))
    this.deserialize(this.users[this.lastClientId])
  }

  save(rc: RunContextBrowser): void {

    this.users[this._clientId] = this.serialize()
    localStorage.setItem(USERS, JSON.stringify(this.users))

    if (this.lastClientId !== this._clientId) {
      this.lastClientId = this._clientId
      localStorage.setItem(LAST_USER, String(this.lastClientId))
    }
  }

  getWebProfilePicBase64(clientId: number): string {
    return this.users[clientId]['webProfilePicBase64']
  }

  getAllClientIds(): number[] { return Object.keys(this.users).map(Number) }

  getAllUserLinkIds(): string[] { return Object.values(this.users).map((user) => {
    return user['userLinkId']
  })}

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
    if (this._clientId) throw('Cannot set clientId when it is already set: ' + 
                        JSON.stringify({clientId, existing:this._clientId}))
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
      webProfilePicBase64 : this._webProfilePicBase64 
    }
  }

  deserialize(obj: {[key: string]: any}) {
    this._clientId              = obj.clientId
    this._userLinkId            = obj.userLinkId
    this.userName               = obj.userName
    this._webProfilePicBase64   = obj.webProfilePicBase64
  }

  $dump() {
    const keys = Object.getOwnPropertyNames(this)

    for (const key of keys) {
      console.info(`${key}=${JSON.stringify(this[key])}`)
    }
  }
  
}