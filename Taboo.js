'use strict'

import http from 'http'
import Game from './Game.js'
import WebServer from './WebServer.js'
import SocketServer from './SocketServer.js'

class Taboo {
  constructor (config) {
    this.config = config || {}

    this.game = new Game()
    this.webServer = new WebServer()
    this.socketServer = new SocketServer(this.game)
  }

  listen (port, host) {
    this.httpServer = http.createServer()
    this.webServer.bindToServer(this.httpServer)
    this.socketServer.bindToServer(this.httpServer)

    this.httpServer.listen(
      port || this.config.port || process.env.PORT || 8080,
      host || this.config.host || process.env.HOST || null
    )
  }
}

export default Taboo
