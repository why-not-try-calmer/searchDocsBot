const Slimbot = require('slimbot');
const slimbot = new Slimbot(process.env['TELEGRAM_TOKEN'] || '1746181670:AAGGB9trk_ro8lRlLztjtI5Mw8DiptcnqFs');
const restify = require('restify');

let server = restify.createServer();

server.use(restify.plugins.bodyParser());

const handle = (req, res, next) => {
  res.send('hello');
  console.log(req)
  return next();
}

server.post('/bot_updates', handle)

server.listen(8443);