const Slimbot = require('slimbot');
const slimbot = new Slimbot(process.env['TELEGRAM_TOKEN'] || '1746181670:AAGGB9trk_ro8lRlLztjtI5Mw8DiptcnqFs');
const restify = require('restify');

let server = restify.createServer();

server.use(restify.plugins.bodyParser());

// Setup webhook integration
slimbot.setWebhook({ url: process.env['BASE_URL'] || 'https://opensuse-docs-bot.herokuapp.com/'});

// Get webhook status
slimbot.getWebhookInfo();

const handle = (req, res, next) => {
  res.send('hello');
  return next();
}

// Handle updates (example)
server.post('/bot_updates', handle)

server.listen(8443);