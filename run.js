#!/usr/local/bin/node
const fs = require('fs');
const lunr = require('lunr')
const fetch = require('node-fetch')

const docs_url = 'https://opensuse.github.io/openSUSE-docs-revamped'
const json_blob_url = 'https://raw.githubusercontent.com/openSUSE/openSUSE-docs-revamped/gh-pages/search/search_index.json'

const search = (s, blob) => {
    const idx = lunr(function () {
        this.ref('location')
        this.field('text')
        blob.docs.forEach(function (doc) {
            this.add(doc)
        }, this)
    })
    return idx.search(s).map(x => docs_url + '/' + x.ref).join('\n')
}

const getSetBlob = (() => {
    let _b = null
    return (b = null) => {
        if (b === null) return _b
        _b = b
    }
})()

const needsARefresh = (() => {
    const offset = 86400
    let last_time = new Date().getSeconds()
    return () => {
        const now = new Date().getSeconds()
        if ((now - last_time) > offset) {
            last_time = now
            return true
        }
        return false
    }
})()

const handler = search_string => {
    if (!needsARefresh() && (getSetBlob() !== null)) {
        console.log(search(search_string, getSetBlob()))
        return;
    }
    return fetch(json_blob_url)
        .then(res => res.json())
        .then(res => {
            getSetBlob(res)
            console.log(search(search_string, getSetBlob()))
        })
        .catch(e => console.error(e))
}

/*
setTimeout(() => {
    handler('btrfs')
}, 2000)
*/