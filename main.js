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
    let users = {}
    const create = user_id => {
        const user = { user_id, user_name: '', found: [], current_index: null, message_id: null }
        users[user_id] = user
    }
    const get = user_id => users[user_id]
    const set = (user_id, update_with) => {
        users[user_id] = Object.assign(users[user_id], update_with)
    }
    return ({ user_id, user_name = null, found = null, current_index = null, message_id = null }) => {
        if (!users[user_id]) create(user_id)
        if (current_index === null || message_id === null) return get(user_id)
        set(user_id, { current_index, message_id, found, user_name: user_name || null })
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

const partition = arr => arr.reduce((acc, val, i) => {
    if (i === 0 || acc[acc.length - 1].length === 3) return [...acc, [val]]
    acc[acc.length - 1].push(val)
    return acc
}, [])

const bot_handler = (req, res, next) => {
    const update = req.body
    if (update.callback_query && update.callback_query.data && update.callback_query.message.message_id) {
        const message_id = update.callback_query.message.message_id
        const [bot_name, chat_id, user_id, queried_index] = update.callback_query.data.split(':')
        if (bot_name !== 'docs-bot' || bot_name === undefined || chat_id === undefined || user_id === undefined || queried_index === undefined) {
            res.send(200)
            return next()
        }
        const current_index = parseInt(queried_index)
        const user = getSetUser({ user_id })
        const text = user.found[queried_index_int].join('\n')
        let optParams = {}
        optParams.reply_markup = JSON.stringify({
            inline_keyboard: [[
                { text: 'Next ' + (1).toString() + '/' + partitioned.length.toString(), callback_data: 'docs-bot:' + chat_id + ':' + user_id + ':' + (current_index + 1).toString() }
            ]]
        })
        slimbot.editMessageText(chat_id, message_id, text, optParams)
        getSetUser({ user_id, message_id, current_index })
        return;
    }
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
        search_handle(found_in_parse).then(found => {
            const user = user_name === undefined ? '' : '@' + user_name + '\n'
            let text;
            let optParams = { reply_to_message_id: parseInt(message_id) }
            if (found.length === 0) {
                text = 'No result about this yet, but keep tabs on ' + DOCS_URL + ' in the upcoming days'
                slimbot.sendMessage(chat_id, text, optParams)
                return;
            }
            const partitioned = partition(found)
            if (partitioned.length === 1) {
                text = user + partitioned[0].join('\n')
                slimbot.sendMessage(chat_id, text, optParams)
                return;
            }
            text = user + partitioned[0].join('\n')
            optParams.reply_markup = JSON.stringify({
                inline_keyboard: [[
                    { text: 'Next ' + (1).toString() + '/' + partitioned.length.toString(), callback_data: 'docs-bot:' + chat_id + ':' + user_id + ':' + "1" }
                ]]
            })
            slimbot.sendMessage(chat_id, text, optParams)
            getSetUser({ current_index: 0, user_id, user_name, found })
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