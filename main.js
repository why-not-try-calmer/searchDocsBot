const { Searches, parse } = require('./lib.js')
const Slimbot = require('slimbot');
const restify = require('restify');

const slimbot = new Slimbot(process.env['TELEGRAM_TOKEN'])
// slimbot.setWebhook({ url: process.env['BOT_ENDPOINT'] })

const server = restify.createServer();
server.use(restify.plugins.bodyParser());

const DOCS_URL = process.env['DOCS_URL']
const SECRET = process.env['SECRET']

const buildInlineButton = (text, keywords, index) => {
    return {
        text,
        callback_data: 'docs-bot:' + keywords + ':' + index.toString()
    }
}

const promoOptParams = {
    reply_markup: JSON.stringify({
        inline_keyboard: [[
            {
                text: 'Get involved!',
                url: 'https://t.me/opensuse_docs'
            }
        ], [
            {
                text: 'Visit our GitHub',
                url: 'https://github.com/openSUSE/openSUSE-docs-revamped-temp'
            }
        ]]
    })
}

const getSignature = user_name => user_name === undefined ? '' : '@' + user_name + '\n'

const renderStats = () => Searches.unstoreKeywordsChats().then(docs => {
    const [per_chat, sums] = docs
    const allStatsMsg = '\nBetween all chats using this bot, top 15 most searched keywords:\n' + sums.map(d => '- ' + d.keyword + ': ' + d.counter).join('\n')
    const chatStatsMsgs = Object.entries(per_chat).map(keyval => {
        const [chat_id, keyword_counter] = keyval
        const chatStats = Object.entries(keyword_counter).map(kv => '- ' + kv[0] + ': ' + kv[1]).slice(0, 15).join('\n')
        const text = 'Thank you for using this bot. Some stats since last week. Top 15 most searched keywords in this chat:\n' + chatStats
        return { chat_id, text }
    })
    return { chatStatsMsgs, allStatsMsg }
})

const renderBroadcastStats = () => renderStats().then(res =>
    Promise.all(res.chatStatsMsgs.map(msg =>
        slimbot.sendMessage(msg.chat_id, msg.text + res.allStatsMsg, promoOptParams))))

const query_handler = update => {
    const [bot_name, keywords, qindex] = update.callback_query.data.split(':')
    if (bot_name !== 'docs-bot' || bot_name === undefined || keywords === undefined || qindex === undefined) return;

    const pages = Searches.g(keywords)
    const current_index = parseInt(qindex)
    const text = pages[current_index].join('\n')

    const message_id = update.callback_query.message.message_id
    const chat_id = update.callback_query.message.chat.id
    const first_row = []

    if (current_index > 0) first_row.push(buildInlineButton('Back', keywords, current_index - 1))
    first_row.push({ text: (current_index + 1).toString() + '/' + pages.length.toString(), callback_data: 'docs-bot:' + keywords + ':' + current_index.toString() })
    if (current_index + 1 < pages.length) first_row.push(buildInlineButton('Next', keywords, current_index + 1))

    const optParams = {
        reply_markup: current_index > 0 ?
            JSON.stringify({ inline_keyboard: [first_row, [{ text: 'Reset', callback_data: 'docs-bot:' + keywords + ':0' }]] }) :
            JSON.stringify({ inline_keyboard: [first_row] })
    }
    slimbot.editMessageText(chat_id, message_id, text, optParams)
}

const reply = (chat_id, user_name, keywords, optParams) => {
    const found = Searches.g(keywords)
    const signature = getSignature(user_name)
    let text;

    if (found.length === 0) {
        text = signature + 'No result about this yet, but keep tabs on ' + DOCS_URL + ' in the upcoming days'
        slimbot.sendMessage(chat_id, text, optParams)
        return Promise.resolve()
    }

    text = signature + found[0].join('\n')

    if (found.length === 1) {
        slimbot.sendMessage(chat_id, text, optParams)
        return Promise.resolve()
    }

    optParams.reply_markup = JSON.stringify({
        inline_keyboard: [[
            {
                text: 'Next ' + '1/' + found.length.toString(),
                callback_data: 'docs-bot:' + keywords + ':' + '1'
            }
        ]]
    })
    slimbot.sendMessage(chat_id, text, optParams)
    return Searches.storeKeywordChat(keywords, chat_id)
}

const bot_handler = (req, res, next) => {
    const update = req.body

    // Case callback_query update
    if (update.callback_query && update.callback_query.data && update.callback_query.message.message_id) {
        query_handler(update)
        res.send(200)
        return next(false)
    }

    // Case 'unhandleable' update
    if (!update.message || !update.message.text) {
        res.send(200)
        return next(false)
    }

    // Case message update
    const message = update.message
    const message_text = message.text
    const parsed = parse(message_text)

    // ... but not for us
    if (!parsed) { res.send(200); return next(false) }

    const chat_id = message.chat.id
    const user_name = message.from.username
    let text;

    // ... erroneous input
    if (parsed.Err) {
        slimbot.sendMessage(chat_id, getSignature(user_name) + parsed.Err)
        res.send(200)
        return next(false)
    }

    const message_id = message.message_id
    const optParams = { reply_to_message_id: parseInt(message_id) }

    //  ...'/start' message
    if (parsed.Ok === 'start') {
        text = 'Search the docs by simply sending a message following this pattern: \n<search for these words> @openSUSE_docs_bot \nor\n/docs <search for these words>. Use /stats to get some use statistics, and /help to bring up this very message.'
        optParams.parse_mode = 'Markdown'
        slimbot.sendMessage(chat_id, text, optParams)
        res.send(200)
        return next(false)
    }

    // ... '/docs' message
    if (parsed.Ok === 'search') return reply(chat_id, user_name, parsed.args, optParams)
        .catch(err => console.error('main:reply: ', err))
        .finally(() => { res.send(200); return next(false) })

    // ... '/stats' message
    if (parsed.Ok === 'stats') return renderStats().then(stats => {
        const { chatStatsMsgs, allStatsMsg } = stats
        const found = chatStatsMsgs.find(d => parseInt(d.chat_id) === chat_id)
        const text = found ? found.text + allStatsMsg : 'No stats on this chat. ' + allStatsMsg
        slimbot.sendMessage(chat_id, text, promoOptParams)
        res.send(200)
        return next(false)
    })

    res.send(200)
    return next(false)
}

server.post('/bot_updates', bot_handler)

server.get('/wakeup', (_, res, next) => {
    if (Searches.refreshNeeded()) return Searches.init()
        .catch(err => console.error('This error occurred ', err))
        .finally(() => { res.send(200); return next(false) })
    res.send(200)
    return next(false)
})

server.get('/search/:keywords', (req, res, next) => {
    const parsed = parse('/docs ' + req.params.keywords)
    if (parsed.Err) {
        res.json("Couldn't parse your input: " + parsed.Err)
        return next(false)
    }
    if (parsed.Ok === 'search') {
        const found = Searches.g(parsed.args)
        if (found.length === 0) { res.json('No result for this query string: ' + req.params.keywords); return next(false) }
        res.json(found[0])
        return next(false)
    }
})

server.get('/stats', (_, res, next) => {
    return Searches.unstoreKeywordsChats()
        .then(docs => res.json(docs))
        .catch(e => res.json('Sorry, this error occurred: ' + e))
        .finally(() => { return next(false) })
})

server.post('/test', (req, res, next) => {
    if (req.body.secret === SECRET) return renderBroadcastStats()
        .catch(e => console.error('Error in /test: ', e))
        .finally(() => { res.send(200); return next(false) })
    res.send(200)
    return next(false)
})

server.listen(process.env['PORT'] || 8443)
