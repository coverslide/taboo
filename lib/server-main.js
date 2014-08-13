var app = module.exports = require('./web-server').init()
var tabooGame = require('./taboo-game').init()
var socketServer = require('./socket-server').init(app, tabooGame)

module.exports = app;
