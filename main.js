const Slimbot = require('slimbot');
const slimbot = new Slimbot(process.env['TELEGRAM_TOKEN']);
// const restify = require('restify');
// const restifyBodyParser = require('restify-plugins').bodyParser;

const search_handle = require ('./lib.js')
 
// Register listeners
 
slimbot.on('message', message => {
  slimbot.sendMessage(message.chat.id, 'Message received');
});
 
// Setup webhook integration
slimbot.setWebhook('https://www.example.com');
 
// Get webhook status
slimbot.getWebhookInfo();
 
// Teardown webhook integration
slimbot.deleteWebhook();