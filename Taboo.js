'use strict';

var http = require('http');
var Game = require('./Game');
var WebServer = require('./WebServer');
var SocketServer = require('./SocketServer');

module.exports = Taboo;

function Taboo (config) {
    this.config = config || {};

    this.game = new Game();
    this.webServer = new WebServer();
    this.socketServer = new SocketServer(this.game);
}

Taboo.prototype.listen = function (port, host) {
    this.httpServer = http.createServer();
    this.webServer.bindToServer(this.httpServer);
    this.socketServer.bindToServer(this.httpServer);

    this.httpServer.listen(port || this.config.port || process.env.PORT || 8080, host || this.config.host || process.env.HOST || null);
}
