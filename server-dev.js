var cp = require('child_process')
  , fs = require('fs')
  , path = require('path')
  , spawnedProcesses = {}
  , env = process.env.NODE_ENV || 'development'
  , port = process.env.PORT || 8080
  , RESTART_LIMIT = 5
  , LOG_DIR = './logs/'
  , PID_DIR = './pids/'
  , outStream = env == 'production' ? fs.createWriteStream(LOG_DIR + base + '.log', {flags: 'a'}) : process.stdout
  , errStream = env == 'production' ? fs.createWriteStream(PID_DIR + base + '.error.log', {flags: 'a'}) : process.stderr

function spawn(module){
  var modName = "string" === typeof module ? module : module.module
    , truename = require.resolve(module)
    , args = module.args || []
    , env = module.env || {PORT: port, NODE_ENV: env, LOGS: LOG_DIR}
    , cwd = module.cwd || path.dirname(truename)
    , base = path.basename(truename, '.js')
    , newProcess = cp.spawn(process.execPath, [truename].concat(args), {env: env, cwd: cwd})
    , ref = spawnedProcesses[base] || (spawnedProcesses[base] = {})
    , pidFilePath = PID_DIR + base + '.pid'

  ref.process = newProcess
  ref.pidFilePath = pidFilePath
  ref.pid = newProcess.pid

  fs.readFile(pidFilePath, 'utf-8', function(err, pid){
    if(!isNaN(pid))
      try{process.kill(pid)}catch(err){}
    fs.writeFile(pidFilePath, ref.pid.toString(),'utf-8', function(err){
      if(err) errStream.write('Warning: pid file not written')
    })
  })

  if(env == 'production'){
    newProcess.stdout.pipe(fs.createWriteStream(LOG_DIR + base + '.log', {flags: 'a'}))
    newProcess.stderr.pipe(fs.createWriteStream(LOG_DIR + base + '.error.log', {flags: 'a'}))
  }
  else{
    newProcess.stdout.pipe(outStream, {end: false})
    newProcess.stderr.pipe(errStream, {end: false})

    if(!ref.watched){
      ref.watched  = true
      fs.watchFile(truename, function(){
        process.kill(newProcess.pid)
      })
    }
  }

  newProcess.on('exit', function(sc){
    var restarts = ref.restarts || (ref.restarts = [])
      , now = new Date().getTime()

    fs.unlink(pidFilePath)
    
    process.stderr.write('\n`' + base + '` module exited with status code ' + sc)
    restarts.unshift(now)
    restarts.splice(0, RESTART_LIMIT)
    if(restarts.length < RESTART_LIMIT || now > restarts[RESTART_LIMIT - 1] + 1000 * RESTART_LIMIT){
      errStream.write(', restarting ...\n')
      process.nextTick(function(){
        spawn(module)
      })
    }
    else{
      process.stderr.write(', shutting down due to too many restarts\n')
      if(env === 'production') //shut down server
        process.exit(1)
    }
  })
}

function watchDir(dir, cb){
  fs.readdir(dir, function(err, dirlist){
    if(err) throw err
    dirlist.forEach(function(file){
      fs.watchFile(dir + '/' + file, function(curr, prev){
        cb(dir + '/' + file)
      })
    })
  })
}

function initdir(dir){
  try{fs.mkdirSync(dir, process.umask() ^ 0777)}
  catch(err){}//do nothing
}

process.on('exit', function(){
  process.stderr.write("Shutting down processess ... ")
  Object.keys(spawnedProcesses).forEach(function(id){
    var ref = spawnedProcesses[id]
    process.stderr.write(id + " ... ")
    try{
      fs.unlinkSync(ref.pidFilePath)
      process.kill(ref.pid)
    }catch(e){
      process.stderr.write("\n ** " + e.message + "\n")
    }
  })

  process.stderr.write(" done.\n")
})

if(require.main == module){
  ;[LOG_DIR, PID_DIR].forEach(initdir)
  ;['./lib/server-main'].forEach(spawn)//running from the same process for now ...
  watchDir('./lib', function(){
    Object.keys(spawnedProcesses).forEach(function(id){
      spawnedProcesses[id].process.kill()
    })
  })
}
