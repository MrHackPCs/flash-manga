const fs = require('fs')
const path = require('path')
const esbuild = require('esbuild')

const SOURCES = [
    {
        id: 'SnapManga',
        name: 'Snap-Manga',
        author: 'Paperback Community',
        desc: 'Extension that pulls manga from snap-manga.com (Thai translation)',
        description: 'Extension that pulls manga from snap-manga.com (Thai translation)',
        website: 'https://www.snap-manga.com',
        websiteBaseURL: 'https://www.snap-manga.com',
        version: '1.0.0',
        icon: 'icon.png',
        language: '🇹🇭',
        contentRating: 'EVERYONE',
        tags: [
            {
                text: 'Thai',
                type: 'default'
            }
        ],
        badges: [
            {
                label: 'Thai',
                textColor: '#FFFFFF',
                backgroundColor: '#4A90E2'
            }
        ],
        capabilities: 117,
        intents: 21,
        developers: [
            {
                name: 'Paperback Community',
                github: 'https://github.com/MrHackPCs'
            }
        ]
    },
    {
        id: 'FlashManga',
        name: 'Flash-Manga',
        author: 'Paperback Community',
        desc: 'Extension that pulls manga from flash-manga.net (Thai translation)',
        description: 'Extension that pulls manga from flash-manga.net (Thai translation)',
        website: 'https://www.flash-manga.net',
        websiteBaseURL: 'https://www.flash-manga.net',
        version: '1.0.5',
        icon: 'icon.png',
        language: '🇹🇭',
        contentRating: 'EVERYONE',
        tags: [
            {
                text: 'Thai',
                type: 'default'
            }
        ],
        badges: [
            {
                label: 'Thai',
                textColor: '#FFFFFF',
                backgroundColor: '#4A90E2'
            }
        ],
        capabilities: 117,
        intents: 21,
        developers: [
            {
                name: 'Paperback Community',
                github: 'https://github.com/MrHackPCs'
            }
        ]
    },
    {
        id: 'MangaKimi',
        name: 'MangaKimi',
        author: 'Paperback Community',
        desc: 'Extension that pulls manga from mangakimi.com (Thai translation)',
        description: 'Extension that pulls manga from mangakimi.com (Thai translation)',
        website: 'https://www.mangakimi.com',
        websiteBaseURL: 'https://www.mangakimi.com',
        version: '1.0.0',
        icon: 'icon.png',
        language: '🇹🇭',
        contentRating: 'EVERYONE',
        tags: [
            {
                text: 'Thai',
                type: 'default'
            }
        ],
        badges: [
            {
                label: 'Thai',
                textColor: '#FFFFFF',
                backgroundColor: '#4A90E2'
            }
        ],
        capabilities: 117,
        intents: 21,
        developers: [
            {
                name: 'Paperback Community',
                github: 'https://github.com/MrHackPCs'
            }
        ]
    },
    {
        id: 'NekoPost',
        name: 'NekoPost',
        author: 'Paperback Community',
        desc: 'Extension that pulls manga from nekopost.net/manga (Thai translation & community)',
        description: 'Extension that pulls manga from nekopost.net/manga (Thai translation & community)',
        website: 'https://www.nekopost.net/manga',
        websiteBaseURL: 'https://www.nekopost.net/manga',
        version: '1.0.2',
        icon: 'icon.png',
        language: '🇹🇭',
        contentRating: 'EVERYONE',
        tags: [
            {
                text: 'Thai',
                type: 'default'
            }
        ],
        badges: [
            {
                label: 'Thai',
                textColor: '#FFFFFF',
                backgroundColor: '#4A90E2'
            }
        ],
        capabilities: 117,
        intents: 21,
        developers: [
            {
                name: 'Paperback Community',
                github: 'https://github.com/MrHackPCs'
            }
        ]
    }
]

async function build() {
    console.log('🚀 Building 4-Source Paperback Repository (Snap-Manga, Flash-Manga, MangaKimi, NekoPost)...')

    const distDir = path.join(__dirname, 'public')
    const v9Dir = path.join(distDir, '0.9')
    const v8Dir = path.join(distDir, '0.8')

    // Clean & create directories
    if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true, force: true })
    }
    fs.mkdirSync(distDir, { recursive: true })
    fs.mkdirSync(v9Dir, { recursive: true })
    fs.mkdirSync(v8Dir, { recursive: true })

    // Copy repo icon
    const repoIcon = path.join(__dirname, 'src', 'SnapManga', 'icon.png')
    if (fs.existsSync(repoIcon)) {
        fs.copyFileSync(repoIcon, path.join(distDir, 'icon.png'))
        fs.copyFileSync(repoIcon, path.join(v9Dir, 'icon.png'))
        fs.copyFileSync(repoIcon, path.join(v8Dir, 'icon.png'))
    }

    // Build each source
    for (const source of SOURCES) {
        console.log(`\n📦 Bundling ${source.name}...`)
        const rootSourceDir = path.join(distDir, source.id)
        const v9SourceDir = path.join(v9Dir, source.id)
        const v8SourceDir = path.join(v8Dir, source.id)
        fs.mkdirSync(rootSourceDir, { recursive: true })
        fs.mkdirSync(v9SourceDir, { recursive: true })
        fs.mkdirSync(v8SourceDir, { recursive: true })

        const footerCode = `
this.Sources = _Sources;
if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports.Sources = this.Sources;
    module.exports.${source.id} = _Sources.${source.id};
    module.exports.${source.id}Info = _Sources.${source.id}Info;
}
if (typeof globalThis !== 'undefined') {
    globalThis.Sources = _Sources;
    globalThis.${source.id} = _Sources.${source.id};
    globalThis.${source.id}Info = _Sources.${source.id}Info;
}
`

        await esbuild.build({
            entryPoints: [path.join(__dirname, 'src', source.id, `${source.id}.ts`)],
            bundle: true,
            outfile: path.join(rootSourceDir, 'source.js'),
            format: 'iife',
            globalName: '_Sources',
            platform: 'browser',
            target: 'es2020',
            sourcemap: false,
            footer: {
                js: footerCode
            }
        })

        // Copy source.js and index.js to all locations
        fs.copyFileSync(path.join(rootSourceDir, 'source.js'), path.join(rootSourceDir, 'index.js'))
        fs.copyFileSync(path.join(rootSourceDir, 'source.js'), path.join(v9SourceDir, 'source.js'))
        fs.copyFileSync(path.join(rootSourceDir, 'source.js'), path.join(v9SourceDir, 'index.js'))
        fs.copyFileSync(path.join(rootSourceDir, 'source.js'), path.join(v8SourceDir, 'source.js'))
        fs.copyFileSync(path.join(rootSourceDir, 'source.js'), path.join(v8SourceDir, 'index.js'))

        // Copy icon
        const iconSrc = path.join(__dirname, 'src', source.id, 'icon.png')
        if (fs.existsSync(iconSrc)) {
            fs.copyFileSync(iconSrc, path.join(rootSourceDir, 'icon.png'))
            fs.copyFileSync(iconSrc, path.join(v9SourceDir, 'icon.png'))
            fs.copyFileSync(iconSrc, path.join(v8SourceDir, 'icon.png'))
        }
        console.log(`✔ Bundled ${source.name} successfully`)
    }

    // 3. Generate Universal versioning.json with all sources
    const versioningUniversal = {
        buildTime: new Date().toISOString(),
        builtWith: {
            toolchain: "0.8.7",
            types: "0.8.7"
        },
        repository: {
            name: "Thai Manga Extensions",
            description: "Thai Manga extensions for Paperback (Snap-Manga, Flash-Manga, MangaKimi & NekoPost)!"
        },
        sources: SOURCES
    }

    const versioningJson = JSON.stringify(versioningUniversal, null, 2)
    fs.writeFileSync(path.join(distDir, 'versioning.json'), versioningJson)
    fs.writeFileSync(path.join(v9Dir, 'versioning.json'), versioningJson)
    fs.writeFileSync(path.join(v8Dir, 'versioning.json'), versioningJson)
    console.log('\n✔ Generated Universal versioning.json with all 4 sources')

    // 4. Fetch the official NetSky web page and adapt it
    console.log('Fetching NetSky 0.9 web app template...')
    let templateHtml = ''
    try {
        const res = await fetch('https://thenetsky.github.io/netskys-extensions/0.9/')
        templateHtml = await res.text()
    } catch (e) {
        console.warn('Could not fetch template:', e.message)
    }

    if (templateHtml) {
        templateHtml = templateHtml
            .replace(/Netsky's Extensions \(0\.9\)/g, "Thai Manga Extensions")
            .replace(/Netsky's extensions for 0\.9!/g, "Thai Manga extensions for Paperback (Snap-Manga, Flash-Manga, MangaKimi & NekoPost)!")
            .replace(/https:\/\/thenetsky\.github\.io\/netskys-extensions\/0\.9/g, "https://mrhackpcs.github.io/flash-manga")

        fs.writeFileSync(path.join(distDir, 'index.html'), templateHtml)
        fs.writeFileSync(path.join(v9Dir, 'index.html'), templateHtml)
        fs.writeFileSync(path.join(v8Dir, 'index.html'), templateHtml)
        console.log('✔ Generated exact NetSky web app interface')
    }

    console.log('\n🎉 4-Source build complete!')
}

build().catch(err => {
    console.error(err)
    process.exit(1)
})
