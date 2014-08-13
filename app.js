var app = module.exports = require('./lib/server-main');

if(require.main == module) {
    app.listen(process.env.PORT || 8081, process.env.HOST);
}
