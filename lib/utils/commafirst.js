var fs = require('fs')
  , newline = {windows: '\r\n'}[process.platform] || '\n'

data = fs.readFileSync('package.json', 'utf-8').split(/[\n\r]+/g)

newData = []
re = /,(\s*)$/
next = false
data.forEach(function(line){
    var str = line
  if(next && /^$/.test(str)){
    str = str.replace(/^(\s*)/, '$1, ')
    next = false
  }
  var match = re.exec(line)
  if(match){
    str = str.replace(re, '$1')
    next = true
  }
  newData.push(str)
})

console.log(newData.join(newline))
