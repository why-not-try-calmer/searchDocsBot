const Slimbot = require('slimbot');
const slimbot = new Slimbot(process.env['TELEGRAM_TOKEN']);
const restify = require('restify');
const search_handle = require('./lib.js')

let server = restify.createServer();
server.use(restify.plugins.bodyParser());

const MENTION = process.env['BOT_IDENTIFIER']
const DOCS_URL = process.env['DOCS_URL']
const COMMAND = '/docs'

const parsed = s => {
    const head = s.slice(0, 5)
    if (head === COMMAND) return s.slice(6)
    if (s.includes(MENTION)) {
        const res = s.split(MENTION).sort((a, b) => a.length - b.length).pop()
        if (res.length > 0) return res
    }
    return null
}

const handle = (req, res, next) => {
    const update = req.body
    if (!update.message || !update.message.message_id || !update.message.text || !update.message.chat.id) {
        res.send(200)
        return next()
    }
    const message = update.message
    const message_id = message.message_id
    const message_text = message.text
    const chat_id = message.chat.id
    if (message_text.slice(0, 6) === '/start') {
        slimbot.sendMessage(chat_id, text = 'Search in the docs by simply sending a message following this pattern: \n<search for these words> ' + MENTION + '\nor\n/docs <search for these words>')
        res.send(200)
        return next()
    }
    const found_in_parse = parsed(message_text)
    if (found_in_parse !== null) {
        search_handle(found_in_parse).then(res => {
            const text = res !== null
                ? res
                : 'No result about this yet, but keep tabs on ' + DOCS_URL + ' in the upcoming days.'
            const optParams = { reply_to_message_id: parseInt(message_id) }
            slimbot.sendMessage(chat_id, text, optParams)
        }).catch(err => console.error(err))
    }
    res.send(200)
    return next()
}

server.post('/bot_updates', handle)
server.listen(process.env['PORT'] || 8443);