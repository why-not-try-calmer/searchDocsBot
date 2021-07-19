const lunr = require('lunr')
const fetch = require('node-fetch')
const { dbDo } = require('./db.js')

const DOCS_URL = process.env['DOCS_URL']
const JSON_BLOB_URL = process.env['JSON_BLOB_URL']
const DAILY_OFFSET = 43200000
const PAGES_UPPER_BOUND = 3
const COMMAND_WORDS = ['/start', '/start@openSUSE_docs_bot', '/docs', '/docs@opensSUSE_docs_bot', '@openSUSE_docs_bot', '/stats', '/stats@openSUSE_docs_bot']
const PARSE_ERRORS = {
    TOO_SHORT: 'Keywords must be at least 3-character long.',
    OS_MISPELLED: "Please, try to be mindful of the good people who fought hard to come up with a good name. It's spelled `openSUSE`. Not "
}

const mispelled = args => args.find(s => s.toLowerCase() === 'opensuse' && s !== 'openSUSE')

function parse(s) {
    const splitted = s.split(' ')
    let {
        cmd,
        args
    } = splitted.reduce((acc, val) => {
        if (acc.cmd) {
            acc.args.push(val);
            return acc
        }
        if (COMMAND_WORDS.some(w => w === val)) {
            acc.cmd = val;
            return acc
        }
        acc.args.push(val)
        return acc
    }, {
        cmd: null,
        args: []
    })
    let mis = mispelled(args)
    if (mis) return {
        Err: PARSE_ERRORS['OS_MISPELLED'] + '`' + mis + '`. You can use `oS` if you prefer :)'
    }
    if (!cmd) return null
    if (cmd.indexOf('start') > -1) return {
        Ok: 'start'
    }
    if (cmd.indexOf('stats') > -1) return {
        Ok: 'stats'
    }
    args = args.join(' ')
    if (args.trim().length < 3) return {
        Err: PARSE_ERRORS['TOO_SHORT']
    }
    return {
        Ok: 'search',
        args
    }
}

function search(s, blob) {
    const idx = lunr(function () {
        this.ref('location')
        this.field('text')
        blob.docs.forEach(function (doc) {
            this.add(doc)
        }, this)
    })
    return idx.search(s).map((l, i) => (i + 1).toString() + ') ' + DOCS_URL + '/' + l.ref)
}

function partition(arr) {
    return arr.reduce((acc, val, i) => {
        if (i === 0 || acc[acc.length - 1].length === PAGES_UPPER_BOUND) return [...acc, [val]]
        acc[acc.length - 1].push(val)
        return acc
    }, [])
}

function collectChats(docs) {
    return docs.reduce((dict, val) => {
        for (const cid of val.chat_id) {
            if (!dict[cid]) dict[cid] = {
                [val.keyword]: 1
            }
            else if (!dict[cid][val.keyword]) dict[cid][val.keyword] = 1
            else dict[cid][val.keyword]++
        }
        return dict
    }, {})
}

const Searches = (() => {
    const searches = new Map()
    let blob = {}
    let last_time = new Date().getTime()
    return {
        init() {
            return fetch(JSON_BLOB_URL)
                .then(res => res.json())
                .then(res => {
                    blob = res
                    searches.forEach((_, k) => searches.set(k, partition(search(k, blob))))
                    console.log('Searches initialized.')
                })
                .catch(err => console.error(err))
        },
        g(keywords) {
            let res;
            res = searches.get(keywords)
            if (res === undefined) {
                res = search(keywords, blob)
                if (res.length > 0) {
                    res = partition(res)
                    this.s(keywords, res)
                }
            }
            return res
        },
        s(keywords, partitioned) { if (!searches.has(keywords)) searches.set(keywords, partitioned) },
        refreshNeeded() {
            const now = new Date().getTime()
            return ((now - last_time) > DAILY_OFFSET)
        },
        storeKeywordChat(keyword, chat_id) {
            return dbDo.transacIncSert(keyword, chat_id)
        },
        unstoreKeywordsChats() {
            const renderSums = arr => arr.sort((a, b) => b.counter - a.counter).slice(0, 15).map(d => ({ keyword: d.keyword, counter: d.counter }))
            return dbDo.getKeywords().then(docs => [collectChats(docs), renderSums(docs)])
        },
    }
})()
Searches.init()
module.exports = { Searches, parse }