import express from 'express';
import path from 'path';

const importPath = import.meta.url;
const importUrl = new URL(importPath);

const __dirname = path.dirname(importUrl.pathname);

class WebServer {
  constructor () {
    const app = (this.express = express());

    app.set('view engine', 'pug');
    app.set('views', __dirname + '/views');

    app.use(express.static(__dirname + '/public'));

    app.get('/', function (req, res, next) {
      res.render('index');
    });

    app.get('/rules', function (req, res, next) {
      res.render('rules');
    });

    app.get('/partial/rules', function (req, res, next) {
      res.partial('rules');
    });
  }

  bindToServer (httpServer) {
    httpServer.on('request', this.express);
  }
}

export default WebServer;
