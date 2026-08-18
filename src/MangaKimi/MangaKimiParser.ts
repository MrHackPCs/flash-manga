import {
    Chapter,
    ChapterDetails,
    MangaTile,
    SourceManga,
    Tag,
    TagSection
} from '@paperback/types'
import { MANGA_KIMI_DOMAIN, cleanUrl, parseChapterNumber, parseThaiDate } from './MangaKimiHelper'

export class MangaKimiParser {

    /**
     * Parses manga tiles from standard MangaReader list item grids (.bs .bsx)
     */
    static parseMangaTiles($: any): MangaTile[] {
        const tiles: MangaTile[] = []

        $('.bs .bsx').each((_: any, element: any) => {
            const linkTag = $('a', element).first()
            const href = linkTag.attr('href') || ''
            const title = linkTag.attr('title')?.trim() || $('.tt', element).text().trim()

            // Extract manga ID slug: e.g. "https://www.mangakimi.com/manga/momiji-to-kouyou/" -> "momiji-to-kouyou"
            const idMatch = href.match(/\/manga\/([^/]+)/)
            const id = idMatch ? idMatch[1] : href.replace(MANGA_KIMI_DOMAIN, '').replace(/\//g, '')

            if (!id || !title) return

            // Image handling
            const imgTag = $('img', element).first()
            const image = imgTag.attr('data-src') || imgTag.attr('src') || ''

            // Subtitle: e.g. "ตอนที่ 10"
            const subtitle = $('.adds .epxs, .adds .epx, .epx, .epxs', element).first().text().trim() || undefined

            tiles.push(
                App.createMangaTile({
                    id,
                    image: cleanUrl(image),
                    title: App.createIconText({ text: title }),
                    subtitleText: subtitle ? App.createIconText({ text: subtitle }) : undefined
                })
            )
        })

        return tiles
    }

    /**
     * Parses the detailed info of a manga series
     */
    static parseMangaDetails($: any, mangaId: string): SourceManga {
        const title = $('h1.entry-title').text().trim() || $('.info-right h1').text().trim()
        
        // Thumbnail image
        const imgTag = $('.info-left .thumb img, .thumb img').first()
        const image = imgTag.attr('data-src') || imgTag.attr('src') || $('meta[property="og:image"]').attr('content') || ''

        // Description synopsis
        const description = $('.entry-content-single[itemprop="description"] p, .entry-content-single, .desc').text().trim()

        // Status: Ongoing / Completed
        let status = 'Ongoing'
        $('.tsinfo .imptdt').each((_: any, el: any) => {
            const text = $(el).text().toLowerCase()
            if (text.includes('สถานะ') || text.includes('status')) {
                if (text.includes('completed') || text.includes('จบแล้ว')) {
                    status = 'Completed'
                }
            }
        })

        // Author / Artist
        let author = ''
        $('.tsinfo .imptdt').each((_: any, el: any) => {
            const text = $(el).text()
            if (text.includes('โพสต์โดย') || text.includes('author') || text.includes('ผู้แต่ง')) {
                author = $('i', el).text().trim() || $(el).text().replace(/โพสต์โดย|author|ผู้แต่ง/gi, '').trim()
            }
        })

        // Genres & Tags
        const tags: Tag[] = []
        $('.mgen a, .seriestugenre a').each((_: any, el: any) => {
            const tagTitle = $(el).text().trim()
            const tagId = $(el).attr('href')?.split('/').filter(Boolean).pop() || tagTitle
            if (tagTitle) {
                tags.push(App.createTag({ id: tagId, label: tagTitle }))
            }
        })

        // Rating
        const ratingText = $('.rating-prc .num, .numscore').first().text().trim()
        const rating = ratingText ? parseFloat(ratingText) : undefined

        const tagSections: TagSection[] = [
            App.createTagSection({
                id: 'genres',
                label: 'Genres',
                tags
            })
        ]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: cleanUrl(image),
                status,
                author: author || undefined,
                artist: author || undefined,
                desc: description,
                tags: tagSections,
                rating
            })
        })
    }

    /**
     * Parses the list of chapters for a manga
     */
    static parseChapterList($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []

        $('#chapterlist ul li, .bxcl ul li, .eplister ul li').each((_: any, element: any) => {
            const linkTag = $('a', element).first()
            const href = linkTag.attr('href') || ''
            
            // Extract chapterId from URL, e.g. "https://www.mangakimi.com/momiji-to-kouyou-1/" -> "momiji-to-kouyou-1"
            const urlParts = href.split('/').filter(Boolean)
            const chapterId = urlParts.pop() || ''

            if (!chapterId) return

            // Chapter Title & Number
            const name = $('.chapternum', element).text().trim() || $('a', element).text().trim()
            const dataNum = $(element).attr('data-num')
            const chapNum = dataNum ? parseFloat(dataNum) : parseChapterNumber(name)

            // Date
            const dateStr = $('.chapterdate', element).text().trim()
            const time = parseThaiDate(dateStr)

            chapters.push(
                App.createChapter({
                    id: chapterId,
                    chapNum,
                    name: name || `ตอนที่ ${chapNum}`,
                    time,
                    langCode: 'th'
                })
            )
        })

        return chapters
    }

    /**
     * Parses images for a specific chapter
     */
    static parseChapterDetails(html: string, mangaId: string, chapterId: string, $: any): ChapterDetails {
        const pages: string[] = []

        // Method 1: Extract JSON from ts_reader.run script
        const match = html.match(/ts_reader\.run\(([\s\S]+?)\);/)
        if (match && match[1]) {
            try {
                const data = JSON.parse(match[1])
                if (data?.sources && Array.isArray(data.sources)) {
                    for (const source of data.sources) {
                        if (source?.images && Array.isArray(source.images)) {
                            for (const img of source.images) {
                                if (img && typeof img === 'string') {
                                    pages.push(cleanUrl(img.trim()))
                                }
                            }
                            if (pages.length > 0) break // Found primary server
                        }
                    }
                }
            } catch (err) {
                // Ignore JSON parse error, fallback to DOM
            }
        }

        // Method 2: DOM fallback (#readerarea img)
        if (pages.length === 0) {
            $('#readerarea img').each((_: any, element: any) => {
                const src = $(element).attr('src') || $(element).attr('data-src') || $(element).attr('data-lazy-src')
                if (src && !src.includes('readerarea.svg') && !src.includes('banner')) {
                    pages.push(cleanUrl(src.trim()))
                }
            })
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId,
            pages
        })
    }

    /**
     * Checks if there is a next page in pagination
     */
    static hasNextPage($: any): boolean {
        return $('.pagination .next, .hpage .r, a.next').length > 0
    }
}
