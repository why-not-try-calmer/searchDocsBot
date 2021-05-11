const { MongoClient } = require('mongodb')
const DB_URI = process.env['DB_URI']
const DB_NAME = 'searchDocsBot'
const client = new MongoClient(DB_URI, { useNewUrlParser: true, useUnifiedTopology: true })

async function composeThenables({ seed = null, thenables }) {
    if (seed && !seed.then) seed = Promise.resolve(seed)
    return thenables.reduce(async (acc, f) => f(await acc), seed)
}

async function withDb({ seed = null, thenables }) {
    if (!Array.isArray(thenables)) thenables = [thenables]
    try {
        return await composeThenables({
            seed,
            thenables
        })
    }
    catch (e) { console.error('withDB: Failed to run theneables at', e) }
}
const dbDo = (() => {
    let db = {}
    return {
        init() {
            return client.connect().then(() => {
                db = client.db(DB_NAME)
                console.log('Database connection pool ready.')
            })
        },
        toArray(cursor) {
            return cursor.toArray()
        },
        toArrays(cursors) {
            return Promise.all(cursors.map(c => c.toArray()))
        },
        setColl(collName) {
            return db.collection(collName)
        },
        listCollections() {
            return db.listCollections()
        },
        getKeywords() {
            const getIt = () => {
                const ref = dbDo.setColl('keywords')
                return ref.find()
            }
            return withDb({ thenables: [getIt, this.toArray] })
        },
        transacIncSert(keyword, chat_id) {
            const filt = { keyword }
            const upd = { $set: { keyword }, $inc: { counter: 1 }, $push: { 'chat_id': chat_id, 'queriedOn': new Date() } }
            const opts = { upsert: 'true' }
            const doIt = () => {
                const ref = dbDo.setColl('keywords')
                return ref.updateOne(filt, upd, opts)
            }
            return withDb({ thenables: [doIt] })
        },
        clearAllCollections() {
            const dropColls = colls => Promise.all(colls.map(c => dbDo.setColl(c.name).drop(c.name)))
            return withDb({ thenables: [this.listCollections, this.toArray, dropColls] })
        }
    }
})()
dbDo.init()
module.exports = { dbDo }