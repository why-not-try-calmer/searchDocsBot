const Slimbot = require('slimbot');
const slimbot = new Slimbot(process.env['TELEGRAM_TOKEN'] || '1746181670:AAGGB9trk_ro8lRlLztjtI5Mw8DiptcnqFs');
const restify = require('restify');

let server = restify.createServer();

server.use(restify.plugins.bodyParser());

const handle = (req, res, next) => {
  const update = req.body
  const message = update.message
  const message_id = message.message_id
  console.log(message)
  slimbot.sendMessage(chat_id=message.chat.id, reply_to_message_id=message_id, text="Ok, thanks for letting me know")
  res.send('ok');
  return next();
}

server.post('/bot_updates', handle)

server.listen(process.env['PORT'] || 8443);