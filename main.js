const Slimbot = require('slimbot');
const slimbot = new Slimbot(process.env['TELEGRAM_TOKEN']);
const restify = require('restify');
const search_handle = require('./lib.js')

let server = restify.createServer();
server.use(restify.plugins.bodyParser());

const parsed = s => {
    const mention = '@openSUSE_docs_bot'
    const command = '/docs'
    const head = s.slice(0, 5)
    if (head === command) return s.slice(6)
    if (s.includes(mention)) {
        const res = s.split(mention).sort((a, b) => b.length - a.length)[0]
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
        slimbot.sendMessage(chat_id, text = 'Search in the docs by simply sending a message following this pattern: \n<search for these words> @opensuse_bot_docs\nor\n/docs <search for these words>')
        res.send(200)
        return next()
    }
    const found_in_parse = parsed(message_text)
    if (found_in_parse !== null) {
        search_handle(found_in_parse).then(res => {
            const text = res === null
                ? 'No result about this yet, but keep tabs on https://opensuse.github.io/openSUSE-docs-revamped in the upcoming days.'
                : res
            slimbot.sendMessage(chat_id, text, reply_to_message_id = message_id)
        }).catch(err => console.error(err))
    }
    res.send(200);
    return next();
}

server.post('/bot_updates', handle)
server.listen(process.env['PORT'] || 8443);