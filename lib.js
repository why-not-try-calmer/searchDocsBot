const lunr = require('lunr')
const fetch = require('node-fetch')

const DOCS_URL = process.env['DOCS_URL']
const JSON_BLOB_URL = process.env['JSON_BLOB_URL']

const needsARefresh = (() => {
    const offset = 604800000
    let last_time = new Date().getTime()
    return () => {
        const now = new Date().getTime()
        if ((now - last_time) > offset) {
            last_time = now
            return true
        }
        return false
    }
})()

const getSetBlob = (() => {
    let _b = null
    return (b = null) => {
        if (b === null) return _b
        _b = b
    }
})()

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

const search_handle = search_string => {
    if (!needsARefresh() && (getSetBlob() !== null)) {
        const found = search(search_string, getSetBlob())
        return Promise.resolve(found)
    }
    return fetch(JSON_BLOB_URL)
        .then(res => res.json())
        .then(res => {
            getSetBlob(res)
            const found = search(search_string, getSetBlob())
            return found.length < 1 ? null : found
        })
        .catch(e => console.error(e))
}

module.exports = search_handle