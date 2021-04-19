import cards from './data/tabooCards.js'
import natural from 'natural'
import { EventEmitter } from 'events'

const LAST_ID_MAX = 0xffffffff
const wordComparer = natural.SoundEx

class Game extends EventEmitter {
  constructor () {
    super()

    this.lastId = 0xffffffff
    this.users = {}
    this.roundEndTime = 0
    this.sockets = {}
    this.phase = 'waiting'
    this.countdown = null
    this.giver = null
    this.giverPool = []
    this.card = null
    this.cardPool = []
  }

  setChannel (channel) {
    this.channel = channel
  }

  getState (cb) {
    cb(
      this.users,
      this.giver,
      this.phase,
      this.phase === 'in progress'
        ? Math.round((this.roundEndTime - new Date().getTime()) / 1000)
        : 0
    )
  }

  addUser (name, socket, cb) {
    let match, num, word
    const names = Object.keys(this.users).map(function (user) {
      return user.name
    })

    if (names.includes(name)) {
      // if name taken, change name
      match = name.match(/(.*?)(\d*)$/)
      num = parseInt(match[2]) || 1
      word = match[1]
      while (names.includes(word + ++num));
      cb({ message: 'Username already taken', altName: word + num })
    } else {
      do {
        if (--this.lastId < 0) {
          this.lastId = LAST_ID_MAX
        }
      } while (this.lastId in this.sockets)

      const userInfo = {
        name: name,
        score: 0,
        id: this.lastId
      }

      this.sockets[userInfo.id] = socket
      this.users[userInfo.id] = userInfo
      this.giverPool.push(userInfo.id)
      if (this.phase === 'waiting') {
        if (this.userTotal() >= 2) {
          this.channel.emit(
            'taboo message',
            'info',
            'server',
            'Game starting in 5 seconds'
          )
          this.startRound()
        } else {
          this.channel.emit(
            'taboo message',
            'warning',
            'server',
            'Need at least 2 people to start game.'
          )
        }
      }
      cb(null, userInfo)
    }
  }

  userTotal () {
    return Object.keys(this.users).length
  }

  processMessage (userId, message) {
    let messageWords, tabooList
    // output standard message
    if (this.giver === userId) {
      // check for taboo word, and various variations

      this.channel.emit('taboo message', 'giver', userId, message)
      messageWords = message
        .trim()
        .toLowerCase()
        .replace(/\W+/g, '')
        .split(/\s+/g) // remove punctuation and separate via spaces

      // probably better to cache this somewhere
      tabooList = this.card.taboo // split up words by spaces
        .concat(this.card.word)
        .reduce(function (prev, curr) {
          return prev
            .concat(curr.toLowerCase().trim().split(/\s+/g)) // break apart by spaces
            .map(function (val) {
              return val.replace(/\W+/g, '') // strip out non-alphanumeric characters
            })
        }, [])

      if (
        tabooList.some(function (tword) {
          return messageWords.some(function (word) {
            return !!new RegExp(tword).exec(word) // using a word contained inside a taboo word. Should test for false positives
          })
        })
      ) {
        return this.triggerTaboo()
      }

      if (
        tabooList.some(function (tword) {
          return messageWords.some(function (word) {
            return wordComparer.compare(word, tword)
          })
        })
      ) {
        return this.triggerTaboo()
      }
    } else if (this.phase === 'in progress') {
      // check if guessword is chosen
      this.channel.emit('taboo message', 'user', userId, message)

      // make regex
      const guessRegex = new RegExp(
        '^' + this.card.word.trim().replace(/[\s\W]+/g, '\\\\W*') + '$',
        'i'
      )

      if (message.trim().match(guessRegex)) this.triggerWinner(userId)

      const guessWords = this.card.word.trim().split(/\W+/g)

      const messageWords = message.trim().split(/\W+/g)

      if (messageWords.length === guessWords.length) {
        if (
          messageWords.every(function (val, i) {
            return wordComparer.compare(val, guessWords[i])
          })
        ) {
          this.triggerWinner(userId)
        }
      }
    } else {
      this.channel.emit('taboo message', 'user', userId, message)
    }
  }

  // giver entered taboo word. decrements score and skips card
  triggerTaboo () {
    const score = {}

    this.channel.emit(
      'taboo message',
      'warning',
      'server',
      'Giver has triggered a taboo word. The last word was: `' +
        this.card.word.toUpperCase() +
        '`'
    )
    this.users[this.giver].score--
    this.chooseCard()

    score[this.giver] = this.users[this.giver].score

    this.channel.emit('score update', score)
  }

  // notifies clients of winner, increments score
  triggerWinner (userId) {
    const score = {}
    this.users[userId].score++
    this.users[this.giver].score++

    score[this.giver] = this.users[this.giver].score
    score[userId] = this.users[userId].score

    this.channel.emit('score update', score)
    this.sockets[userId].broadcast.emit(
      'taboo message',
      'important',
      'server',
      this.users[userId].name +
        ' guessed correctly. The word was: `' +
        this.card.word.toUpperCase() +
        '`'
    )
    this.sockets[userId].emit(
      'taboo message',
      'important',
      'server',
      'Congratulations, you guessed correctly! The word was: `' +
        this.card.word.toUpperCase() +
        '`'
    )

    this.chooseCard()
  }

  // starts countdown to start of game
  startRound () {
    this.phase = 'game countdown'
    if (this.countdown) clearTimeout(this.countdown)
    this.countdown = setTimeout(this.pickGiver.bind(this), 5000) // wait 5 seconds
  }

  // choose a giver from giverPool
  pickGiver () {
    if (this.giverPool.length <= 0) this.giverPool = Object.keys(this.users)
    this.giver = this.giverPool.splice(
      Math.floor(this.giverPool.length * Math.random()),
      1
    )[0]
    if (this.giver in this.sockets && this.giver in this.users) {
      this.channel.emit('new giver', this.giver)
      this.sockets[this.giver].emit(
        'taboo message',
        'important',
        'server',
        'You are the new giver. Good luck!'
      )
      this.sockets[this.giver].broadcast.emit(
        'taboo message',
        'info',
        'server',
        'Giver is ' + this.users[this.giver].name
      )
      this.phase = 'in progress'
      this.roundEndTime = new Date().getTime() + 60000
      this.countdown = setTimeout(this.restartRound.bind(this), 60000)
      this.chooseCard()
    } else this.pickGiver()
  }

  restartRound () {
    this.phase = 'round ended'
    this.channel.emit(
      'taboo message',
      'important',
      'server',
      'Round has ended. New round starts in 5 seconds ...'
    )
    this.channel.emit('end round')
    this.giver = null
    this.startRound()
  }

  endRound () {
    if (this.countdown) {
      clearTimeout(this.countdown)
    }
    this.channel.emit('end round')
  }

  chooseCard () {
    if (this.cardPool.length <= 0) {
      this.cardPool = cards.concat()
    }

    this.card = this.cardPool.splice(
      Math.floor(Math.random() * this.cardPool.length),
      1
    )[0]

    this.sockets[this.giver].emit('new card', this.card)
    // this.channel.emit("taboo message", "info", "server", "Next card ... ")
  }

  skipCard (userId) {
    if (userId === this.giver) {
      // if user is not giver, ignore
      this.channel.emit(
        'taboo message',
        'important',
        'server',
        'Card skipped. Last word was : `' + this.card.word.toUpperCase() + '`'
      )
      this.chooseCard()
    }
  }

  deleteUser (userInfo, cb) {
    if (userInfo) {
      let giverIndex
      const id = userInfo.id

      delete this.sockets[id]

      if (id in this.users) {
        delete this.users[id]
        this.channel.emit(
          'taboo message',
          'warning',
          'server',
          userInfo.name + ' has left the game with score ' + userInfo.score
        )
        giverIndex = this.giverPool.indexOf(id)

        if (giverIndex > -1) {
          this.giverPool.splice(giverIndex, 1)
        }
        // TODO: clean up this process
        if (this.giver === id) {
          this.giver = null
          if (this.userTotal() < 2) {
            this.channel.emit(
              'taboo message',
              'warning',
              'server',
              'Giver has quit. Need another player to join to start game'
            )
            this.endRound()
            this.phase = 'waiting'
          } else {
            this.channel.emit(
              'taboo message',
              'important',
              'server',
              'Giver has quit. New giver to be chosen in 5 seconds'
            )
            this.endRound()
            this.startRound()
          }
        } else if (this.userTotal() < 2) {
          this.channel.emit(
            'taboo message',
            'warning',
            'server',
            'User ' +
              userInfo.name +
              ' has quit. Need another player to join to start game'
          )
          this.endRound()
          this.phase = 'waiting'
        }
        cb()
      } else {
        cb(new Error('user id not found'))
      }
    }
  }
}

export default Game
