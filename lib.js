import lunr from 'lunr'
import fetch from 'node-fetch'
import { parse } from 'node-html-parser'
import dbDo from './db.js'

const TW_DOCS_URL = process.env['TW_DOCS_URL']
const TW_DOCS_JSON_URL = process.env['TW_DOCS_JSON_URL']
const LEAP_DOCS_URL = process.env['LEAP_DOCS_URL']
const DAILY_OFFSET = 43200000
const PAGES_UPPER_BOUND = 3
const COMMAND_WORDS = ['/broadcast', '/start', '/start@openSUSE_docs_bot', '/docs', '/docs@opensSUSE_docs_bot', '@openSUSE_docs_bot', '/stats', '/stats@openSUSE_docs_bot']
const PARSE_ERRORS = {
    TOO_SHORT: 'Keywords must be at least 3-character long.',
    OS_MISPELLED: "I'd just like to interject for a moment.  What you're referring to as "
}

function getLeapParse() {
    return fetch(LEAP_DOCS_URL)
        .then(response => response.text())
        .then(text => {
            const root = parse(text)
            const sections = root.querySelectorAll('div[class^="sect"]')
            const results = []
            for (const sec of sections) {
                let name = sec.querySelector('span.name')
                let number = sec.querySelector('.number')
                if (!number || !name) { continue }
                name = name.text
                number = number.text.trim()
                const permalink = sec.querySelector('a.permalink').getAttribute('href')
                const contents = sec.querySelectorAll('p').join('')
                results.push({ name, permalink, number, contents })
            }
            return results
        })
}

function toLeapIndex(soup) {
    return lunr(function () {
        this.ref('permalink')
        this.field('text')
        for (const s of soup) {
            this.add({ 'name': s.name, 'text': s.contents, 'permalink': s.permalink })
        }
    })
}

function makeLeapIndex() {
    return getLeapParse().then(soup => toLeapIndex(soup))
}


function parseMessageContents(s) {
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
    if (!cmd) return null
    if (cmd.indexOf('start') > -1) return {
        Ok: 'start'
    }
    if (cmd.indexOf('stats') > -1) return {
        Ok: 'stats',
    }
    if (cmd.indexOf('broadcast') > -1) {
        const secret = args.shift()
        args = args.join(' ')
        return {
            Ok: 'broadcast',
            secret,
            args
        }
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

function search(s, idx, distro) {
    return idx.search(s).map((l, i) => (i + 1).toString() + ') ' + (distro === 'tw' ? TW_DOCS_URL : LEAP_DOCS_URL) + '/' + l.ref)
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
    const searches = { leap: new Map(), tw: new Map() }
    let indexes = { leap: null, tw: null }
    let last_time = new Date().getTime()
    return {
        init() {
            return fetch(TW_DOCS_JSON_URL)
                .then(res => res.json())
                .then(blob => {
                    indexes.tw = lunr(function () {
                        this.ref('location')
                        this.field('text')
                        blob.docs.forEach(function (doc) {
                            this.add(doc)
                        }, this)
                    })
                    console.log('Tumbleweed index ready.')
                    return makeLeapIndex()
                })
                .then(leap_idx => {
                    indexes.leap = leap_idx
                    console.log('Leap index ready.\nApp successfully initialized.')
                })
                .catch(err => console.error(err))
        },
        g(keywords, distro) {
            let res = searches[distro].get(keywords)
            if (res === undefined) {
                res = search(keywords, indexes[distro], distro)
                if (res.length > 0) {
                    res = partition(res)
                    this.s(keywords, res, distro)
                }
            }
            return res
        },
        s(keywords, partitioned, distro) { if (!searches[distro].has(keywords)) searches[distro].set(keywords, partitioned) },
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
export { Searches, parseMessageContents }