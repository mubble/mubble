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

  private _clientId     : number
  private _userLinkId   : string
  userName              : string

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

  switchNewUser(rc: RunContextBrowser, clientId: number, 
    userLinkId: string, userName: string) {

    this._clientId    = clientId
    this._userLinkId  = userLinkId
    this.userName     = userName
    this.save(rc)
  }

  switchUserOnNextRun(clientId: number) {
    this.lastClientId = clientId
    localStorage.setItem(LAST_USER, String(this.lastClientId))
  }

  save(rc : RunContextBrowser): void {

    this.users[this._clientId] = this.serialize()
    localStorage.setItem(USERS, JSON.stringify(this.users))

    if (this.lastClientId !== this._clientId) {
      this.lastClientId = this._clientId
      localStorage.setItem(LAST_USER, String(this.lastClientId))
    }
  }

  getAllClientIds(): number[] { return Object.keys(this.users).map(Number) }

  getClientIdForUserLink(reqUserLinkId: string): number {

    for (let clientId in this.users) {
      const userLinkId: string = this.users[clientId]['userLinkId']
      if (userLinkId === reqUserLinkId) return Number(clientId)
    }
    return null
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
    if (this._userLinkId) throw('Cannot set userLinkId when it is already set: ' + 
                        JSON.stringify({userLinkId, existing:this._userLinkId}))
    this._userLinkId = userLinkId                    
  }

  serialize(): object {
    return {
      clientId      : this._clientId,
      userLinkId    : this._userLinkId,
      userName      : this.userName
    }
  }

  deserialize(obj: {[key: string]: any}) {
    this._clientId    = obj.clientId
    this._userLinkId  = obj.userLinkId
    this.userName     = obj.userName
  }

  $dump() {
    const keys = Object.getOwnPropertyNames(this)

    for (const key of keys) {
      console.info(`${key}=${JSON.stringify(this[key])}`)
    }
  }
  
}