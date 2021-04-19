const Slimbot = require('slimbot');
const slimbot = new Slimbot(process.env['TELEGRAM_TOKEN'] || '1746181670:AAGGB9trk_ro8lRlLztjtI5Mw8DiptcnqFs');
const restify = require('restify');
const search_handle = require ('./lib.js')

let server = restify.createServer();

server.use(restify.plugins.bodyParser());

const handle = (req, res, next) => {
  const update = req.body
  const message = update.message
  const message_id = message.message_id
  const chat_id = message.chat.id
  console.log(message)
  slimbot.sendMessage(chat_id, text="Ok, thanks for letting me know", reply_to_message_id=message_id)
  res.send(200);
  return next();
}

server.post('/bot_updates', handle)

server.listen(process.env['PORT'] || 8443);