const Slimbot = require('slimbot');
const slimbot = new Slimbot(process.env['TELEGRAM_TOKEN']);
const restify = require('restify');

let server = restify.createServer();
server.use(restify.bodyParser());

// Setup webhook integration
slimbot.setWebhook({ url: 'https://www.example.com/bot_updates' });

// Get webhook status
slimbot.getWebhookInfo();

// Handle updates (example)
server.post('/bot_updates', function handle(req, res) {
  let update = req.body;
  // handle type of update here...
  // i.e. if (update.message) { ... }
});

server.listen(8443);