const Slimbot = require('slimbot');
const slimbot = new Slimbot('1716616291:AAHq1hYejkQt6HFHyw2WzQ3O-xORdYnAvUM');
const restify = require('restify');
const search_handle = require('./lib.js')

let server = restify.createServer();
server.use(restify.plugins.bodyParser());

const MENTION = '@test_any_the_bot'
const DOCS_URL = 'https://opensuse.github.io/openSUSE-docs-revamped'
const COMMAND = '/docs'

const getSetUser = (() => {
    let user_ids = {}
    return ({ user_id, user_name = null, results = null, current_index = null }) => {
        if (!user_ids[user_id]) user_ids[user_id] = { user_name, results }
        if (results === null) return { results: user_ids[user_id].results, user_name: user_ids[user_id].user_name }
        user_ids[user_id].results = results
        user_ids[user_id].user_name = user_name
        user_ids[user_id].current_index = current_index
    }
})()

const parsed = s => {
    const head = s.slice(0, 5)
    if (head === COMMAND) return s.slice(6)
    if (s.includes(MENTION)) {
        const res = s.split(MENTION).sort((a, b) => a.length - b.length).pop()
        if (res.length > 0) return res
    }
    return null
}

const bot_handler = (req, res, next) => {
    const update = req.body
    if (!update.message || !update.message.message_id || !update.message.text || !update.message.chat.id) {
        res.send(200)
        return next()
    }
    const message = update.message
    const message_id = message.message_id
    const message_text = message.text
    const chat_id = message.chat.id
    const user_id = message.from.id
    const user_name = message.from.username
    if (message_text.slice(0, 6) === '/start') {
        const text = 'Search in the docs by simply sending a message following this pattern: \n<search for these words> ' + MENTION + '\nor\n/docs <search for these words>'
        slimbot.sendMessage(chat_id, text)
    }
    const found_in_parse = parsed(message_text)
    if (found_in_parse !== null) {
        search_handle(found_in_parse).then(found_threesomes => {
            const user = user_name === undefined ? '' : '@' + user_name + '\n'
            let text;
            let optParams = { reply_to_message_id: parseInt(message_id) }
            if (found_threesomes === null) {
                text = 'No result about this yet, but keep tabs on ' + DOCS_URL + ' in the upcoming days'
                slimbot.sendMessage(chat_id, text, optParams)
                return;
            }
            if (found_threesomes.length === 1) {
                text = user + found_threesomes[0].join('\n')
                slimbot.sendMessage(chat_id, text, optParams)
                return;
            }
            // getSetUser({ user_id, user_name, results: found_threesomes })
            console.log(found_threesomes)
            text = user + found_threesomes[0].join('\n')
            optParams.reply_markup = JSON.stringify({
                inline_keyboard: [[
                    { text: 'Next ' + (1).toString() + '/' + found_threesomes.length.toString(), callback_data: 'nextPage' }
                ]]
            })
            slimbot.sendMessage(chat_id, text, optParams)
            console.log(update)
        }).catch(err => console.error(err))
    }
    res.send(200)
    return next()
}

const web_handler = (req, res, next) => {
    const searchwords = req.params.searchwords
    search_handle(searchwords).then(found => {
        if (found === null) found = 'No result about this yet, but keep tabs on ' + DOCS_URL + ' in the upcoming days'
    })
    res.contentType = 'json'
    res.send({ searchwords, found })
    return next()
}

server.post('/bot_updates', bot_handler)
server.get('/docs/:searchwords', web_handler)
server.listen(process.env['PORT'] || 8443);