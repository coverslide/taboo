'use strict';

var SocketIO = require('socket.io');
var EventEmitter = require('events').EventEmitter;

module.exports = SocketServer;

function SocketServer(game){
    EventEmitter.call(this);
    this.initialize(game);
}

SocketServer.prototype = Object.create(EventEmitter.prototype)

SocketServer.prototype.initialize = function (game) {
    var io = this.io = new SocketIO; 
    this.game = game;

    this.game.setChannel(io);

    io.on('connection', function(socket){
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
                        io.emit('new user', userInfo)
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
        
        socket.on("skip card", function () {
            game.skipCard(user.id)
        })

        socket.on('disconnect', function () {
            if (user) {
                game.deleteUser(user, function (err) {
                    if (!err) {
                        io.emit('remove user', user.id);
                    }
                });
            }
        })
    })
}

SocketServer.prototype.bindToServer = function (httpServer) {
    this.io.attach(httpServer);
};
