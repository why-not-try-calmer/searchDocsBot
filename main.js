const { partition, parse, search_handle, Searches } = require('./lib.js')
const Slimbot = require('slimbot');
const restify = require('restify');

const slimbot = new Slimbot(process.env['TELEGRAM_TOKEN']) //'1716616291:AAHq1hYejkQt6HFHyw2WzQ3O-xORdYnAvUM'
const MENTION = process.env['MENTION'] //'@test_any_the_bot' //
const DOCS_URL = process.env['DOCS_URL'] // 'https://opensuse.github.io/openSUSE-docs-revamped' // 

slimbot.setWebhook({ url: process.env['BOT_ENDPOINT'] });
let server = restify.createServer(); 
server.use(restify.plugins.bodyParser());

const buildInlineButton = (text, keywords, index) => {
    return {
        text, 
        callback_data: 'docs-bot:' + keywords + ':' + index.toString()
    }
}

const query_handler = update => {
    const [bot_name, keywords, qindex] = update.callback_query.data.split(':')
    if (bot_name !== 'docs-bot' || bot_name === undefined || keywords === undefined || qindex === undefined) return;

    const message_id = update.callback_query.message.message_id
    const chat_id = update.callback_query.message.chat.id
    const current_index = parseInt(qindex)
    const partitioned = Searches.g(keywords)
    const text = partitioned[current_index].join('\n')
    const payload = []

    if (current_index > 0) payload.push(buildInlineButton('Previous', keywords, current_index - 1))
    payload.push({ text: (current_index + 1).toString() + '/' + partitioned.length.toString(), callback_data: 'docs-bot:' + keywords + ':' + current_index.toString() })
    if (current_index + 1 < partitioned.length) payload.push(buildInlineButton('Next', keywords, current_index + 1))
    let optParams = {}
    optParams.reply_markup = JSON.stringify({ inline_keyboard: [payload] })
    slimbot.editMessageText(chat_id, message_id, text, optParams)
}

const reply = (chat_id, message_id, user_name, keywords, found) => {
    signature = user_name === undefined ? '' : '@' + user_name + '\n'
    let text;
    let optParams = { reply_to_message_id: parseInt(message_id) }

    // Nothing found
    if (found.length === 0) {
        text = signature + 'No result about this yet, but keep tabs on ' + DOCS_URL + ' in the upcoming days'
        slimbot.sendMessage(chat_id, text, optParams)
        return;
    }

    // At least one page, means there is something to cache
    const partitioned = partition(found)
    Searches.s(keywords, partitioned)

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
                text: 'Next ' + '1/' + partitioned.length.toString(),
                callback_data: 'docs-bot:' + keywords + ':' + "1"
            }
        ]]
    })
    slimbot.sendMessage(chat_id, text, optParams)
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
    const user_name = message.from.username

    // Case '/start' message
    if (message_text.slice(0, 6) === '/start') {
        const text = 'Search in the docs by simply sending a message following this pattern: \n<search for these words> ' + MENTION + '\nor\n/docs <search for these words>'
        slimbot.sendMessage(chat_id, text)
    }

    // Case '/docs' message
    const keywords = parse(message_text)
    if (keywords !== null) {
        const results = Searches.g(keywords)
        if (results !== undefined) reply(chat_id, message_id, user_name, keywords, results)
        else search_handle(keywords).then(found => reply(chat_id, message_id, user_name, keywords, found)).catch(err => console.error(err))
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

/*
slimbot.on('message', message => {
    const chat_id = message.chat.id
    const message_id = message.id
    const user_name = message.from.user_name
    const keywords = parse(message.text)
    if (keywords !== null) {
        const results = Searches.g(keywords)
        if (results !== undefined) reply(chat_id, message_id, user_name, keywords, results)
        else search_handle(keywords).then(found => reply(chat_id, message_id, user_name, keywords, found)).catch(err => console.error(err))
    }
})

slimbot.startPolling();
*/