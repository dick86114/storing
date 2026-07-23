package com.idickies.storing.auth

interface SessionStore {
  fun read(): SessionTokens?
  fun write(tokens: SessionTokens)
  fun clear()
}
