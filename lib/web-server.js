var fs = require('fs')
  , path = require('path')
  , express = require('express')
  , stylus = require('stylus')
  , host = process.env.HOST
  , port = process.env.PORT || 8080
  , env = process.env.NODE_ENV || 'development'
  , root = path.resolve(__dirname,'..')

module.exports = WebServer.init = WebServer

function WebServer(){
  var that = express.createServer()
    , app = that

  app.configure(function(){
    app.set('view engine', 'jade')
    app.set('views', root + '/views')
    app.locals({env: env})

    app.use(function(req,res,next){res.removeHeader('X-Powered-By');next()}) //don't need to expose server information

    app.use(express.favicon(root + '/public/favicon.ico'))
    app.use(stylus.middleware({src: root + '/views/' , dest: root + '/public' , debug: (env !== 'production')}))
    app.use(express.static(root + '/public'))
    app.use(app.router)
    app.use(function(req,res, next){
      throw new Error("No matching route")
    })
  })

  app.configure('development', function(){
    app.use(express.errorHandler({ showStack: true, dumpExceptions: true }))
  })

  app.configure('production', function(){
    app.error(function(err, req, res, next){
      res.render('error')
    })
    app.error(function(err, req, res, next){
      res.send('<h1 style="text-align:center">Bad Request</h1><hr />', {'content-type': 'text/html'}, 500)
    })
  })

  app.get('/', function(req, res, next){
    res.render('index')
  })

  app.get('/rules', function(req, res, next){
    res.render('rules')
  })

  app.get('/partial/rules', function(req, res, next){
    res.partial('rules')
  })

  return app
}
