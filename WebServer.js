'use strict';

var express = require('express');

module.exports = WebServer.init = WebServer;

function WebServer(){
    var app = this.express = express();

    app.set('view engine', 'jade')
    app.set('views', __dirname + '/views')

    app.use(express.static(__dirname + '/public'));

    app.get('/', function(req, res, next){
        res.render('index');
    });

    app.get('/rules', function(req, res, next){
        res.render('rules');
    });

    app.get('/partial/rules', function(req, res, next){
        res.partial('rules');
    });
}

WebServer.prototype.bindToServer = function (httpServer) {
    httpServer.on('request', this.express);
}
