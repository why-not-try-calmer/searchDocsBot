const Slimbot = require('slimbot');
const slimbot = new Slimbot(process.env['TELEGRAM_TOKEN'] || '1746181670:AAGGB9trk_ro8lRlLztjtI5Mw8DiptcnqFs');
const restify = require('restify');
const search_handle = require('./lib.js')

let server = restify.createServer();

server.use(restify.plugins.bodyParser());

const parsed = s => {
    const mention = '@opensuse_dr_docs'
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
    const message = update.message
    const message_id = message.message_id
    const message_text = message.text
    const chat_id = message.chat.id
    const found_in_parse = parsed(message_text)
    if (found_in_parse !== null) {
        const found_in_docs = search_handle(found_in_parse) || 'No result about this yet, but keep tabs on https://opensuse.github.io/openSUSE-docs-revamped in the upcoming days.'
        slimbot.sendMessage(chat_id, text = found_in_docs, reply_to_message_id = message_id)
    }
    res.send(200);
    return next();
}

server.post('/bot_updates', handle)

server.listen(process.env['PORT'] || 8443);