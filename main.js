const { partition, parse, search_handle } = require('./lib.js')
const Slimbot = require('slimbot');
const restify = require('restify');

const slimbot = new Slimbot(process.env['TELEGRAM_TOKEN']);
const MENTION = process.env['MENTION']
const DOCS_URL = process.env['DOCS_URL']

let server = restify.createServer();
server.use(restify.plugins.bodyParser());

const Users = (() => {
    let users = {}
    return {
        init(user_id, message_id, chat_id, partitioned) {
            users[user_id] = { message_id, chat_id, partitioned }
        },
        get(user_id) {
            return users[user_id]
        },
        set(user_id, update_with) {
            if (update_with.user_id) delete update_with.user_id
            Object.assign(users[user_id], update_with)
        }
    }
})()

const query_handler = update => {
    const message_id = update.callback_query.message.message_id
    const [bot_name, chat_id, user_id, qindex] = update.callback_query.data.split(':')
    
    if (bot_name !== 'docs-bot' || bot_name === undefined || chat_id === undefined || user_id === undefined || queried_index === undefined) {
        res.send(200)
        return next()
    }
    
    const current_index = parseInt(qindex)
    const text = Users.get(user_id).partitioned[current_index].join('\n')
    let payload = [{ text: 'Next ' + (current_index + 1).toString() + '/' + partitioned.length.toString(), callback_data: 'docs-bot:' + chat_id + ':' + user_id + ':' + (current_index + 1).toString() }]
    if (current_index > 0) payload.unshift({ text: 'Previous', callback_data: 'docs-bot:' + chat_id + ':' + user_id + ':' + (current_index + 1).toString() })
    inline_keyboard = [[payload]]
    let optParams = {}
    optParams.reply_markup = JSON.stringify({ inline_keyboard })
    
    slimbot.editMessageText(chat_id, message_id, text, optParams)
    Users.set(user_id, { current_index: current_index + 1 })
}

const bot_handler = (req, res, next) => {
    const update = req.body
    // Case callback_query update
    if (update.callback_query && update.callback_query.data && update.callback_query.message.message_id) {
        query_handler(update)
        res.send(200)
        return next()
    }
    // Case 'unhandleable' update
    if (!update.message || !update.message.message_id || !update.message.text || !update.message.chat.id) {
        res.send(200)
        return next()
    }
    // Case message update
    const message = update.message
    const message_id = message.message_id
    const message_text = message.text
    const chat_id = message.chat.id
    const user_id = message.from.id
    const user_name = message.from.username
    // Case '/start' message
    if (message_text.slice(0, 6) === '/start') {
        const text = 'Search in the docs by simply sending a message following this pattern: \n<search for these words> ' + MENTION + '\nor\n/docs <search for these words>'
        slimbot.sendMessage(chat_id, text)
    }
    // Case '/docs' message
    const searchwords = parse(message_text)
    if (found_in_parse !== null) {
        search_handle(found_in_parse).then(found => {
            const signature = user_name === undefined ? '' : '@' + user_name + '\n'
            let text;
            let optParams = { reply_to_message_id: parseInt(message_id) }
            // No result, nothing to store
            if (found.length === 0) {
                text = 'No result about this yet, but keep tabs on ' + DOCS_URL + ' in the upcoming days'
                slimbot.sendMessage(chat_id, text, optParams)
                return;
            }
            // Only one page, nothing to store either
            const partitioned = partition(found)
            if (partitioned.length === 1) {
                text = signature + partitioned[0].join('\n')
                slimbot.sendMessage(chat_id, text, optParams)
                return;
            }
            // More than one page, setting up minimally, sending, and then creating user, saving 'found' 
            text = signature + partitioned[0].join('\n')
            optParams.reply_markup = JSON.stringify({
                inline_keyboard: [[
                    {
                        text: 'Next ' + '1 /' + partitioned.length.toString(),
                        callback_data: 'docs-bot:' + chat_id + ':' + user_id + ':' + "1"
                    }
                ]]
            })
            slimbot.sendMessage(chat_id, text, optParams)
            Users.init(user_id, message_id, chat_id, partitioned)
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