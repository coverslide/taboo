var cards = require('./data/tabooCards.js');
var natural = require('natural');
var LAST_ID_MAX = 0xffffffff;
var wordComparer = natural.SoundEx;
var EventEmitter = require('events').EventEmitter;


function Game(){
    EventEmitter.call(this);

    this.lastId = 0xFFFFFFFF;
    this.users = {};
    this.roundEndTime = 0;
    this.sockets = {};
    this.phase = 'waiting';
    this.countdown = null;
    this.giver = null;
    this.giverPool = [];
    this.card = null;
    this.cardPool = [];
}

module.exports = Game.init = Game;

Game.prototype = Object.create(EventEmitter.prototype);

//provide the socket channel for the server
Game.prototype.setChannel = function (channel) {
    this.channel = channel;
};

//initialize game, get current game state
Game.prototype.getState = function (cb) {
    cb(this.users, this.giver, this.phase, this.phase === 'in progress' ? Math.round((this.roundEndTime - new Date().getTime()) / 1000) : 0);
};

Game.prototype.addUser = function (name, socket, cb) {
    var match, num, word;
    var names = Object.keys(this.users).map(function(user){return user.name});

    if (~names.indexOf(name)) {//if name taken, change name
        match = name.match(/(.*?)(\d*)$/);
        num = parseInt(match[2]) || 1;
        word = match[1];
        while(~names.indexOf(word + (++num)));
        cb({message: "Username already taken", altName: word + num});
    } else {
        do{
            if (--this.lastId < 0) {
                this.lastId = LAST_ID_MAX;
            }
        }
        while(this.lastId in this.sockets);

        userInfo = {
            name: name,
            score: 0,
            id: this.lastId
        };

        this.sockets[userInfo.id] = socket;
        this.users[userInfo.id] = userInfo;
        this.giverPool.push(userInfo.id);
        if (this.phase === 'waiting' ) {
            if (this.userTotal() >= 2) {
                this.channel.emit("taboo message", "info", "server", "Game starting in 5 seconds");
                this.startRound();
            } else {
                this.channel.emit("taboo message", "warning", "server", "Need at least 2 people to start game.");
            }
        }
        cb(null, userInfo);
    }
}

Game.prototype.userTotal = function(){
    return Object.keys(this.users).length
}

//global handler for all messages
Game.prototype.processMessage = function(userId, message){
    var messageWords, tabooList
    //output standard message
    if(this.giver == userId){
        //check for taboo word, and various variations

        this.channel.emit('taboo message', 'giver', userId, message)
        var messageWords = message.trim().toLowerCase().replace(/\W+/g, '').split(/\s+/g) //remove punctuation and separate via spaces

        //probably better to cache this somewhere
        var tabooList = this.card.taboo //split up words by spaces
            .concat(this.card.word)
            .reduce(function(prev, curr){
                return prev.concat(curr.toLowerCase().trim().split(/\s+/g)) //break apart by spaces
                    .map(function(val){
                        return val.replace(/\W+/g, '') // strip out non-alphanumeric characters
                    })}, [])

        if(tabooList.some(function(tword){
            return messageWords.some(function(word){
                return !!(new RegExp(tword).exec(word)) //using a word contained inside a taboo word. Should test for false positives
            })
        })) {
            return this.triggerTaboo()
        }



        if(tabooList.some(function(tword){
            return messageWords.some(function(word){
                return wordComparer.compare(word, tword);
            })
        }))
            return this.triggerTaboo()
    }
    else if(this.phase == "in progress"){
        //check if guessword is chosen
        this.channel.emit('taboo message', 'user', userId, message)

        //make regex
        var guessRegex = new RegExp('^' + this.card.word.trim()
            .replace(/[\s\W]+/g, '\\\\W*') + '$','i')


        if(message.trim().match(guessRegex))
            this.triggerWinner(userId)

        var guessWords = this.card.word.trim().split(/\W+/g)

        var messageWords = message.trim().split(/\W+/g)

        if(messageWords.length == guessWords.length) {
            if (messageWords.every(function (val, i) {
                    return wordComparer.compare(val, guessWords[i]);
                })
            ) {
                this.triggerWinner(userId);
            }
        }
    } else {
        this.channel.emit('taboo message', 'user', userId, message);
    }
}

//giver entered taboo word. decrements score and skips card
Game.prototype.triggerTaboo = function(){
    var score = {}

    this.channel.emit("taboo message", 'warning', 'server', "Giver has triggered a taboo word. The last word was: `" + this.card.word.toUpperCase() + "`")
    this.users[this.giver].score--
    this.chooseCard()

    score[this.giver] = this.users[this.giver].score

    this.channel.emit("score update", score)
}

//notifies clients of winner, increments score
Game.prototype.triggerWinner = function(userId){
    var score = {}
    this.users[userId].score++
    this.users[this.giver].score++

    score[this.giver] = this.users[this.giver].score
    score[userId] = this.users[userId].score

    this.channel.emit("score update", score)
    this.sockets[userId].broadcast.emit("taboo message", "important", 'server',     this.users[userId].name + " guessed correctly. The word was: `" + this.card.word.toUpperCase() + "`")
    this.sockets[userId].emit("taboo message", "important", 'server', "Congratulations, you guessed correctly! The word was: `" + this.card.word.toUpperCase() + "`")

    this.chooseCard()
}

//starts countdown to start of game
Game.prototype.startRound = function(){
    this.phase = 'game countdown'
    if(this.countdown)
        clearTimeout(this.countdown)
    this.countdown = setTimeout(this.pickGiver.bind(this), 5000) // wait 5 seconds 
}

//choose a giver from giverPool
Game.prototype.pickGiver = function(){
    if(this.giverPool.length <= 0)
        this.giverPool = Object.keys(this.users)
    this.giver = this.giverPool.splice(Math.floor(this.giverPool.length * Math.random()), 1)[0]
	if((this.giver in this.sockets) && (this.giver in this.users)){
		this.channel.emit("new giver", this.giver)
		this.sockets[this.giver].emit('taboo message', 'important', 'server', "You are the new giver. Good luck!")
		this.sockets[this.giver].broadcast.emit('taboo message', 'info', 'server', "Giver is " + this.users[this.giver].name)
		this.phase = 'in progress'
		this.roundEndTime = new Date().getTime() + 60000
		this.countdown = setTimeout(this.restartRound.bind(this), 60000)
		this.chooseCard()
	}
	else
		this.pickGiver()
}

Game.prototype.restartRound = function(){
    this.phase = "round ended"
    this.channel.emit("taboo message", "important", "server", "Round has ended. New round starts in 5 seconds ...")
    this.channel.emit("end round")
    this.giver = null
    this.startRound()
}

Game.prototype.endRound = function(){
    if (this.countdown) {
        clearTimeout(this.countdown);
    }
    this.channel.emit("end round");
};

Game.prototype.chooseCard = function(){

    if (this.cardPool.length <= 0) {
        this.cardPool = cards.concat();
    }

    this.card = this.cardPool.splice(Math.floor(Math.random() * this.cardPool.length), 1)[0];

    this.sockets[this.giver].emit("new card", this.card);
    //this.channel.emit("taboo message", "info", "server", "Next card ... ")
};

Game.prototype.skipCard = function (userId) {
    if (userId == this.giver) {//if user is not giver, ignore
        this.channel.emit("taboo message", "important", "server", "Card skipped. Last word was : `" + this.card.word.toUpperCase() + "`");
        this.chooseCard();
    }
};

Game.prototype.deleteUser = function (userInfo, cb) {
    if (userInfo) {
        var giverIndex;
        var id = userInfo.id;

        delete this.sockets[id];

        if (id in this.users) {
            delete this.users[id];
            this.channel.emit('taboo message', 'warning', 'server', userInfo.name + " has left the game with score " + userInfo.score);
            giverIndex = this.giverPool.indexOf(id);

            if (giverIndex > -1) {
                this.giverPool.splice(giverIndex, 1);
            }
            //TODO: clean up this process
            if (this.giver == id) {
                this.giver = null;
                if (this.userTotal() < 2) {
                    this.channel.emit('taboo message', 'warning', 'server', "Giver has quit. Need another player to join to start game");
                    this.endRound();
                    this.phase = 'waiting';
                } else {
                    this.channel.emit('taboo message', 'important', 'server', "Giver has quit. New giver to be chosen in 5 seconds");
					this.endRound();
					this.startRound();
                }
            } else if (this.userTotal() < 2) {
                this.channel.emit('taboo message', 'warning', 'server', "User " + userInfo.name + " has quit. Need another player to join to start game");
				this.endRound();
                this.phase = 'waiting';
            }
            cb();
        } else {
            cb(new Error("user id not found"));
        }
    }
};
