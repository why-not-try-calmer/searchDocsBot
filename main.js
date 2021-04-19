const Slimbot = require('slimbot');
const slimbot = new Slimbot(process.env['TELEGRAM_TOKEN'] || '1746181670:AAGGB9trk_ro8lRlLztjtI5Mw8DiptcnqFs');
const restify = require('restify');

let server = restify.createServer();

server.use(restify.plugins.bodyParser());

// Setup webhook integration
slimbot.setWebhook({ url: process.env['BASE_URL'] || 'https://opensuse-docs-bot.herokuapp.com/'});

// Get webhook status
slimbot.getWebhookInfo();

// Handle updates (example)
server.post('/bot_updates', function handle(req, res) {
  let update = req.body;
  // handle type of update here...
  // i.e. if (update.message) { ... }
});

server.listen(8443);