import {
    Chapter,
    ChapterDetails,
    MangaTile,
    SourceManga,
    Tag,
    TagSection
} from '@paperback/types'
import { SNAP_MANGA_DOMAIN, cleanUrl, parseChapterNumber, parseThaiDate } from './SnapMangaHelper'

export class SnapMangaParser {

    /**
     * Parses manga tiles from standard list item grids (Madara / Themesia)
     */
    static parseMangaTiles($: any): MangaTile[] {
        const tiles: MangaTile[] = []
        const seen = new Set<string>()

        const items = $('.page-item-detail, .c-tabs-item__content, .badge-pos-1, .row.c-tabs-item__content, .bs .bsx')
        items.each((_: any, element: any) => {
            const linkTag = $('.post-title a, .item-thumb a, a[href*="/manga/"]', element).first()
            const href = linkTag.attr('href') || ''
            const title = $('.post-title a, .item-thumb a', element).first().text().trim() || linkTag.attr('title')?.trim() || $('.tt', element).text().trim()

            // Extract manga ID slug: e.g. "https://www.snap-manga.com/manga/black-corporation-joseon/" -> "black-corporation-joseon"
            const idMatch = href.match(/\/manga\/([^/?#]+)/)
            const id = idMatch ? idMatch[1] : ''

            if (!id || !title || seen.has(id) || id === '?genres_collapse=on') return
            seen.add(id)

            // Image handling
            const imgTag = $('img', element).first()
            const image = imgTag.attr('data-src') || imgTag.attr('src') || imgTag.attr('data-lazy-src') || ''

            // Subtitle: e.g. "ตอนที่ 131"
            const subtitle = $('.list-chapter .chapter-item .chapter a, .adds .epxs, .adds .epx, .epx, .epxs', element).first().text().trim() || undefined

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
        const title = $('.post-title h1, .post-title h3, .profile-manga .post-title h1, h1.entry-title, .info-right h1').first().text().trim()
        
        // Thumbnail image
        const imgTag = $('.summary_image img, .thumb img, .info-left .thumb img').first()
        const image = imgTag.attr('data-src') || imgTag.attr('src') || $('meta[property="og:image"]').attr('content') || ''

        // Description synopsis
        const description = $('.description-summary .summary__content, .manga-excerpt, .entry-content-single, .desc, .entry-content').first().text().trim()

        // Status: Ongoing / Completed
        let status = 'Ongoing'
        const statusText = $('.post-status .summary-content, .tsinfo .imptdt').text().toLowerCase()
        if (statusText.includes('completed') || statusText.includes('จบแล้ว')) {
            status = 'Completed'
        }

        // Author / Artist
        let author = $('.author-content a, .artist-content a').map((_: any, el: any) => $(el).text().trim()).get().join(', ')
        if (!author) {
            $('.tsinfo .imptdt').each((_: any, el: any) => {
                const text = $(el).text()
                if (text.includes('โพสต์โดย') || text.includes('author') || text.includes('ผู้แต่ง')) {
                    author = $('i', el).text().trim() || $(el).text().replace(/โพสต์โดย|author|ผู้แต่ง/gi, '').trim()
                }
            })
        }

        // Genres & Tags
        const tags: Tag[] = []
        $('.genres-content a, .mgen a, .seriestugenre a').each((_: any, el: any) => {
            const tagTitle = $(el).text().trim()
            const tagId = $(el).attr('href')?.split('/').filter(Boolean).pop() || tagTitle
            if (tagTitle) {
                tags.push(App.createTag({ id: tagId, label: tagTitle }))
            }
        })

        // Rating
        const ratingText = $('.post-total-rating .score, .rating-prc .num, .numscore').first().text().trim()
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
        const seen = new Set<string>()

        $('.listing-chapters_wrap .wp-manga-chapter, ul.main.version-chap li.wp-manga-chapter, #chapterlist ul li, .bxcl ul li, .eplister ul li').each((_: any, element: any) => {
            const linkTag = $('a', element).first()
            const href = linkTag.attr('href') || ''
            
            // Extract chapterId from URL, e.g. "https://www.snap-manga.com/manga/black-corporation-joseon/%e0%b8%95%e0%b8%ad%e0%b8%99%e0%b8%97%e0%b8%b5%e0%b9%88-131/" -> "ตอนที่-131"
            const urlParts = href.split('/').filter(Boolean)
            const rawSlug = urlParts.pop() || ''
            const chapterId = decodeURIComponent(rawSlug)

            if (!chapterId || seen.has(chapterId)) return
            seen.add(chapterId)

            // Chapter Title & Number
            const name = linkTag.text().trim() || $('.chapternum', element).text().trim()
            const dataNum = $(element).attr('data-num')
            const chapNum = dataNum ? parseFloat(dataNum) : parseChapterNumber(name)

            // Date
            const dateStr = $('.chapter-release-date', element).text().trim() || $('.chapterdate', element).text().trim()
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

        // Method 1: Madara reading area (.reading-content img, .page-break img)
        $('.reading-content img, .page-break img').each((_: any, element: any) => {
            const src = $(element).attr('data-src') || $(element).attr('src') || $(element).attr('data-lazy-src')
            if (src && !src.includes('banner') && !src.includes('ads')) {
                pages.push(cleanUrl(src.trim()))
            }
        })

        // Method 2: Extract JSON from ts_reader.run script
        if (pages.length === 0) {
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
                                if (pages.length > 0) break
                            }
                        }
                    }
                } catch (err) {
                    // Ignore JSON parse error
                }
            }
        }

        // Method 3: DOM fallback (#readerarea img)
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
        return $('.nav-previous, .pagination .next, a.next, .wp-pagenavi .nextpostslink, .wp-pagenavi a.next, .hpage .r').length > 0
    }
}
