const lunr = require('lunr')
const fetch = require('node-fetch')

const DOCS_URL = process.env['DOCS_URL']
const JSON_BLOB_URL = process.env['JSON_BLOB_URL']
const MENTION = process.env['MENTION']
const COMMAND = '/docs'

const search = (s, blob) => {
    const idx = lunr(function () {
        this.ref('location')
        this.field('text')
        blob.docs.forEach(function (doc) {
            this.add(doc)
        }, this)
    })
    return idx.search(s).map(l => '- ' + DOCS_URL + '/' + l.ref)
}

module.exports = {
    Searches: (function () {
        const searches = new Map()
        const offset = 604800000
        let blob = {}
        let last_time = new Date().getTime()
        return {
            g(keywords) { return searches.get(keywords) },
            s(keywords, partitioned) { if (!searches.has(keywords)) searches.set(keywords, partitioned) },
            needs_refresh() {
                const now = new Date().getTime()
                if ((now - last_time) > offset) {
                    last_time = now
                    return true
                }
                return false
            },
            refresh(fresh_blob) {
                blob = fresh_blob
                searches.forEach((_, k) => searches.set(k, search(k, blob)))
            },
            blob() { return blob; }
        }
    })(),
    search_handle(search_string) {
        if (!module.exports.Searches.needs_refresh()) {
            const blob = module.exports.Searches.blob()
            const found = search(search_string, blob)
            return Promise.resolve(found)
        }
        return fetch(JSON_BLOB_URL)
            .then(res => res.json())
            .then(blob => {
                // Refreshing cache
                module.exports.Searches.refresh(blob)
                const found = search(search_string, blob)
                return found.length < 1 ? null : found
            })
            .catch(e => console.error(e))
    },
    parse(s) {
        const head = s.slice(0, 5)
        if (head === COMMAND) return s.slice(6)
        if (s.includes(MENTION)) {
            const res = s.split(MENTION).sort((a, b) => a.length - b.length).pop()
            if (res.length > 0) return res
        }
        return null
    },
    partition(arr) {
        return arr.reduce((acc, val, i) => {
            if (i === 0 || acc[acc.length - 1].length === 3) return [...acc, [val]]
            acc[acc.length - 1].push(val)
            return acc
        }, [])
    }
}