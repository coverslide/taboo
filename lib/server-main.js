var app, tabooGame, webServer, socketServer
  , port = process.env.PORT || 8080
  , host = process.env.HOST
  , env = process.env.NODE_ENV || 'development'

app = module.exports = require('./web-server').init()
tabooGame = require('./taboo-game').init()
socketServer = require('./socket-server').init(app, tabooGame)

if(require.main == module)
  app.listen(port, host)
