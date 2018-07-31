/*------------------------------------------------------------------------------
   About      : Trie Data Structure
   
   Created on : Fri Mar 16 2018
   Author     : Christy George
   
   Copyright (c) 2018 Mubble Networks Private Limited. All rights reserved.
------------------------------------------------------------------------------*/

import * as lo                                   from 'lodash'
import {RunContextServer}                        from '../rc-server'

export type TrieValue = any

export type TrieResult = {
  wrd : string
  val : TrieValue
} | undefined

export class TrieNode {
  public character: string;
  public value: TrieResult
  public children: Map<string, TrieNode>;

  constructor(key?: string) {
      if (key) this.character = key;
      this.children = new Map<string, TrieNode>();
  }
}

export class Trie {
  private root: TrieNode 
  private addCount : number = 0
  private dupCount : number = 0

  constructor() {
      this.root = new TrieNode();
  }

  stats (rc: RunContextServer) {
    // rc.isStatus() && rc.status (rc.getName (this), 'Added', this.addCount, 'Objects to the trie,', this.dupCount, 'Duplicates')
    return { addCount: this.addCount, dupCount: this.dupCount }
  }

  public insert(rc: RunContextServer, word: string, value: TrieValue): boolean {
      let node = this.root
      let level = 0;

      for (const char of word) {
          let tnode = node.children.get(char)
          if (!tnode) {
              tnode = new TrieNode(char);
              node.children.set(char, tnode);
          }
          node = tnode
      }
      if (node.value && node.value.val !== value) {
        //rc.isStatus() && rc.status (rc.getName (this), 'Duplicate Found, Word:', word, '=>', node.value, 'to', value)
        this.dupCount ++
        return false
      }
      // Adding to the Trie
      this.addCount ++
      node.value = { wrd: word, val: value }
      // rc.isDebug() && rc.debug (rc.getName (this), 'Added Word, Word:', word, '=>', node.value)
      return true
    }

  public searchWords (rc: RunContextServer, words: Array<string>) : TrieValue {
    let currentNode = this.root;
    let match : TrieResult

    // console.log ('==> Words:', JSON.stringify (words))
    for (var idx in words) {
      const jwords  = words.slice (Number (idx)).join(''), // Join the 
            tmatch = this.searchLongest (rc, jwords)
      // if tmatch length is <= 6, it should be >= word length. [Indi should not be returned if word = India/Indigo]
      if (tmatch && tmatch.wrd.length <=6 && tmatch.wrd.length < words[idx].length) continue 
      if (tmatch && (!match || match.wrd.length < tmatch.wrd.length)) match = tmatch
      if (tmatch && tmatch.wrd.length === words[idx].length) rc.isDebug() && rc.debug (rc.getName (this), '\Found:', words[idx], '[' + words[idx].length + '/' + words.length + ']', '=>', JSON.stringify (tmatch))
      else if (tmatch) rc.isDebug() && rc.debug (rc.getName (this), '\tCheck:', words[idx], '[' + words[idx].length + '/' + words.length + ']', '=>', JSON.stringify (tmatch))
    }
    return match ? match.val : null
  }

  public searchLeading(rc: RunContextServer, string: string): TrieValue {
    const match = this.searchLongest(rc, string)
    return match ? match.val : null
  }
  
  private searchLongest (rc: RunContextServer, word: string): TrieResult {
    let match : TrieResult
    let currentNode = this.root
    lo.forEach ([...word], (char, idx) => {
      const node = currentNode.children.get(char);
      if (!node) return false // break the forEach!
      if (node.value) match = node.value
      currentNode = node;
    })
    return match
  }

  private search(rc: RunContextServer, word: string): TrieValue {
    const node = this.getNode(rc, word);
    return (node && node.value) ? node.value.val : null
  }

  private getNode(rc: RunContextServer, word: string): TrieNode | null {
    let node = null;
    let currentNode = this.root.children;

    for (const char of word) {
      node = currentNode.get(char);
      if (node) currentNode = node.children;
      else return null;
    }
    return node;
  }
}
