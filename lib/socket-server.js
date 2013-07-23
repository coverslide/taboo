var socketIO = require('socket.io')
  , port = process.env.PORT || 8080
  , host = process.env.HOST
  , env = process.env.NODE_ENV || 'development'

function SocketServer(){
  var that = Object.create(SocketServer.prototype)
  initSocketServer.apply(that, Array.prototype.slice.call(arguments))
  return that
}
module.exports = SocketServer.init = SocketServer

SocketServer.prototype = Object.create(require('events').EventEmitter.prototype)

function initSocketServer(port, host, game){
  var io, channel

  if(arguments.length < 3){
    game = host
    host = null
  }

  this.io = io = socketIO.listen(port, host)

	this.io.configure('production', function(){
		io.configure('production', function(){
			io.enable('browser client etag');
			io.enable('browser client minification');
			io.set('log level', 1);

			io.set('transports', [
				'websocket'
			, 'flashsocket'
			, 'htmlfile'
			, 'xhr-polling'
			, 'jsonp-polling'
			]);
		});
	})

  this.game = game

  this.tabooChannel = channel = this.io.of('/taboo')

  game.setChannel(channel)

  channel.on('connection', function(socket){
    var user

    game.getState(function(users, giver, phase, timeLeft){
      socket.emit('game state', users, giver, timeLeft)
      socket.emit("taboo message", 'important', 'server', 'Welcome to taboo, please enter your name to join!' + (timeLeft ? ' A game is currently in progress, feel free to jump right in!' : ''))
    })

    socket.on('enter username', function(username){
      username = username.trim().replace(/\s+/g, ' ')
      if(username.length < 3){
        socket.emit('invalid name', "The name you entered is too short")
      }
      else{
        game.addUser(username, socket, function(error, userInfo){
          if(error)
            socket.emit('alternate name', error.message, error.altName)
          else{
            user = userInfo
            socket.emit('username accepted', userInfo)
            channel.emit('new user', userInfo)
          }
        })
      }
    })

    socket.on('user message', function(message){
      message = message.trim()
      if(message.toLowerCase() == '/skip'){//so hands dont need to leave the keyboard
        game.skipCard(user.id)
      }
      else if(message){
        game.processMessage(user.id, message)
      }
    })
    
    socket.on("skip card", function(){
      game.skipCard(user.id)
    })

    socket.on('disconnect', function(){
      if(user)
        game.deleteUser(user, function(err){
          if(!err)
            channel.emit('remove user', user.id)
					//else
						//just ignore
        })
    })
  })
}

if(require.main === module)
  SocketServer.init(port, host)
