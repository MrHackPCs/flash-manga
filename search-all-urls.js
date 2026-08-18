async function searchAllChunks() {
    const startUrl = 'https://www.nekopost.net/_app/immutable/entry/app.BgjVv6jR.js'
    const res = await fetch(startUrl)
    const text = await res.text()
    const chunks = text.match(/\/entry\/[a-zA-Z0-9._-]+\.js|\/chunks\/[a-zA-Z0-9._-]+\.js|\/nodes\/[a-zA-Z0-9._-]+\.js/g) || []

    for (const chunk of [...new Set(chunks)]) {
        const cUrl = `https://www.nekopost.net/_app/immutable${chunk}`
        try {
            const cRes = await fetch(cUrl)
            const cText = await cRes.text()

            const urls = cText.match(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z0-9.-]+[a-zA-Z0-9._\-\/]*/g) || []
            const filtered = urls.filter(u => !u.includes('w3.org') && !u.includes('jsdelivr') && !u.includes('google') && !u.includes('youtube'))
            if (filtered.length > 0) {
                console.log(`\nChunk: ${chunk}`)
                console.log('URLs:', [...new Set(filtered)])
            }
        } catch (e) {}
    }
}

searchAllChunks().catch(console.error)
