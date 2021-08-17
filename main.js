const { Searches, parseMessageContents } = require('./lib.js')
const Slimbot = require('slimbot');
const restify = require('restify');

const slimbot = new Slimbot(process.env['TELEGRAM_TOKEN'])
// slimbot.setWebhook({ url: process.env['BOT_ENDPOINT'] })

const server = restify.createServer();
server.use(restify.plugins.bodyParser());

const DOCS_URL = process.env['DOCS_URL']
const SECRET = process.env['SECRET']

const Drain = {
    flag: false,
    run() { setTimeout(() => this.flag = true, 3000) }
}

const buildInlineButton = (text, distro, keywords, index) => {
    return {
        text,
        callback_data: 'docs-bot:' + distro + ':' + keywords + ':' + index.toString()
    }
}

const defaultLowerKeyboard = [
    [
        {
            text: 'Telegram chat!',
            url: 'https://t.me/opensuse_docs'
        },
        {
            text: 'GitHub',
            url: 'https://github.com/openSUSE/openSUSE-docs-revamped-temp'
        }
    ],
    [
        {
            text: 'Activities',
            url: 'https://lists.opensuse.org/archives/list/doc@lists.opensuse.org/latest'
        },
        {
            text: 'Plans',
            url: 'https://en.opensuse.org/openSUSE:Documentation_migration'
        }
    ]
]

const defaultOptParams = {
    parse_mode: 'Markdown',
    reply_markup: JSON.stringify({
        inline_keyboard: defaultLowerKeyboard
    })
}

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

const broadcastAnnouncement = announcement => renderStats().then(res =>
    Promise.all(res.chatStatsMsgs.map(msg =>
        slimbot.sendMessage(msg.chat_id, announcement, defaultOptParams))))

const query_handler = update => {
    const [bot_name, distro, keywords, qindex] = update.callback_query.data.split(':')
    if (bot_name !== 'docs-bot' || bot_name === undefined || keywords === undefined || qindex === undefined) return;

    const pages = Searches.g(keywords, distro)
    const current_index = parseInt(qindex)
    const text = pages[current_index].join('\n')

    const message_id = update.callback_query.message.message_id
    const chat_id = update.callback_query.message.chat.id
    const first_row = []

    if (current_index > 0) first_row.push(buildInlineButton('Back', distro, keywords, current_index - 1))
    first_row.push({ text: (current_index + 1).toString() + '/' + pages.length.toString(), callback_data: 'docs-bot:' + distro + ':' + keywords + ':' + current_index.toString() })
    if (current_index + 1 < pages.length) first_row.push(buildInlineButton('Next', distro, keywords, current_index + 1))

    const optParams = {
        reply_markup: current_index > 0 ?
            JSON.stringify({ inline_keyboard: [first_row, [{ text: 'Reset', callback_data: 'docs-bot:' + distro + ':' + keywords + ':0' }]] }) :
            JSON.stringify({
                inline_keyboard: [first_row, [buildInlineButton('Tumbleweed/Leap', distro === 'tw' ? 'leap' : 'tw', keywords, 0)], ...defaultLowerKeyboard]
            })
    }
    slimbot.editMessageText(chat_id, message_id, text, optParams)
}

const reply = (chat_id, keywords, optParams) => {
    const found = Searches.g(keywords, 'tw')
    let text;

    if (found.length === 0) {
        text = 'No result about this yet, but keep tabs on ' + DOCS_URL + ' in the upcoming days'
        slimbot.sendMessage(chat_id, text, optParams)
        return Promise.resolve()
    }

    text = found[0].join('\n')

    if (found.length === 1) {
        slimbot.sendMessage(chat_id, text, optParams)
        return Promise.resolve()
    }

    optParams.reply_markup = JSON.stringify({
        inline_keyboard: [
            [
                {
                    text: 'Next ' + '1/' + found.length.toString(),
                    callback_data: 'docs-bot:tw:' + keywords + ':1'
                }
            ], [{ text: 'Search Leap docs instead?', callback_data: 'docs-bot:leap:' + keywords + ':0' }], ...defaultLowerKeyboard]
    })
    slimbot.sendMessage(chat_id, text, optParams)
    return Searches.storeKeywordChat(keywords, chat_id)
}

const bot_handler = (req, res, next) => {
    // Draining upon bot restart to avoid the avalanche of missed calls
    if (!Drain.flag) {
        res.send(200)
        return next(false)
    }

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
    const parsed = parseMessageContents(message_text)

    // ... but not for us
    if (!parsed) { res.send(200); return next(false) }

    const chat_id = message.chat.id
    let text;

    const message_id = message.message_id
    const optParams = { reply_to_message_id: parseInt(message_id) }

    // ... erroneous input
    if (parsed.Err) {
        optParams.parse_mode = 'Markdown'
        slimbot.sendMessage(chat_id, parsed.Err, optParams)
        res.send(200)
        return next(false)
    }

    //  ...'/start' message
    if (parsed.Ok === 'start') {
        text = 'Search the docs by simply sending a message following this pattern: \n<search for these words> @openSUSE_docs_bot \nor\n/docs <search for these words>. Use /stats to get some use statistics, and /help to bring up this very message.'
        slimbot.sendMessage(chat_id, text, optParams)
        res.send(200)
        return next(false)
    }

    // ... '/docs' message
    if (parsed.Ok === 'search') return reply(chat_id, parsed.args, optParams)
        .catch(err => console.error('main:reply: ', err))
        .finally(() => { res.send(200); return next(false) })

    // ... '/stats' message
    if (parsed.Ok === 'stats') return renderStats().then(stats => {
        const { chatStatsMsgs, allStatsMsg } = stats
        const found = chatStatsMsgs.find(d => parseInt(d.chat_id) === chat_id)
        const text = found ? found.text + allStatsMsg : 'No stats on this chat. ' + allStatsMsg
        slimbot.sendMessage(chat_id, text, defaultOptParams)
        res.send(200)
        return next(false)
    })
    // ... '/broadcast' message
    if (parsed.Ok === 'broadcast' && parsed.secret === SECRET) return broadcastAnnouncement(parsed.args)
        .catch(err => console.error('main: broadcast: ', err))
        .finally(() => { res.send(200); return next(false) })

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
    const parsed = parseMessageContents('/docs ' + req.params.keywords)
    if (parsed.Err) {
        res.json("Couldn't parse your input: " + parsed.Err)
        return next(false)
    }
    if (parsed.Ok === 'search') {
        const found = Searches.g(parsed.args, 'tw')
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

server.post('/announce', (req, res, next) => {
    if (req.body.secret === SECRET) return broadcastAnnouncement(req.body.message)
        .catch(e => console.error('Error in /announce: ', e))
        .finally(() => { res.send(200); return next(false) })
    res.send(200)
    return next(false)
})

Drain.run()

server.listen(process.env['PORT'] || 8443)
