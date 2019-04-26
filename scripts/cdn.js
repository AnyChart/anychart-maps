const COMPANY_ALIAS = process.env.CDN_COMPANY_ALIAS;
const CONSUMER_KEY = process.env.CDN_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.CDN_CONSUMER_SECRET;
const ZONE_ID = process.env.CDN_ZONE_ID;
const maxcdn = require('maxcdn').create(COMPANY_ALIAS, CONSUMER_KEY, CONSUMER_SECRET);

const path = require('path');

const { getVersion, filesList } = require('./utils');

const DIST_PATH = path.resolve(__dirname, '../dist');


/**
 * Purges files on cdn.
 * @param {Array.<string>} files Files to purge.
 */
function purge(files) {
    return new Promise((resolve, reject) => {
        maxcdn.del(`zones/pull.json/${ZONE_ID}/cache`, { files }, function(err, results) {
            if (err) {
                reject(err);
            }
            resolve(results);
        })
    })
}


/**
 * Chunk size.
 * @type {number}
 */
const CHUNK_SIZE = 200;


/**
 * Main function.
 * Calls external MaxCDN api to drop cache on cdn.
 */
async function dropCache() {
    const version = await getVersion();
    const files = (await filesList(DIST_PATH)).map(fileName => {
        const rel = path.relative(DIST_PATH, fileName)
        return `/locales/${version}/${rel}`;
    });
    const chunks = [];
    // split all files to chunk by CHUNK_SIZE
    while (files.length > 0) {
        chunks.push(files.splice(0, CHUNK_SIZE))
    }

    console.log(`Total chunks: ${chunks.length}\n`);
    // chaining chunks to purge
    let chain = Promise.resolve('START');
    for (let i = 0; i < chunks.length; i++) {
        let chunk = chunks[i];
        chain = chain.then((results) => {
            if (results)
                console.log('RESULTS:', results);
            console.log(`Purging: ${i+1} chunk`);
            console.log(chunk);
            return purge(chunk);
        })
    }

    chain = chain.then(results => {
        console.log('RESULTS:', results);
    }, err => {
        throw err
    });
}

// Run drop cache.

dropCache().catch(err => {
    console.log(err);
    process.exit(1);
});
