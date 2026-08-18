import {
    Chapter,
    ChapterDetails,
    ContentRating,
    HomeSection,
    HomeSectionType,
    PagedResults,
    Request,
    Response,
    SearchRequest,
    Source,
    SourceInfo,
    SourceIntents,
    SourceManga
} from '@paperback/types'
import * as cheerio from 'cheerio'
import { MANGA_KIMI_DOMAIN } from './MangaKimiHelper'
import { MangaKimiParser } from './MangaKimiParser'

// Ensure App.createCheerioAPI is always available if anything calls it
if (typeof App !== 'undefined' && !App.createCheerioAPI) {
    App.createCheerioAPI = (html: string) => cheerio.load(html)
}

export const MangaKimiInfo: SourceInfo = {
    version: '1.0.0',
    name: 'MangaKimi',
    icon: 'icon.png',
    author: 'Paperback Community',
    authorWebsite: 'https://github.com',
    description: 'Extension that scrapes manga from mangakimi.com (Thai translation)',
    contentRating: ContentRating.EVERYONE,
    websiteBaseURL: MANGA_KIMI_DOMAIN,
    sourceIntents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.MANGA_SEARCH | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED
}

export class MangaKimi extends Source {
    requestManager = App.createRequestManager({
        requestsPerSecond: 4,
        requestTimeout: 20000
    })

    override getMangaShareUrl(mangaId: string): string {
        return `${MANGA_KIMI_DOMAIN}/manga/${mangaId}/`
    }

    /**
     * Cloudflare Bypass Request
     */
    getCloudflareBypassRequest(): Request {
        return App.createRequest({
            url: MANGA_KIMI_DOMAIN,
            method: 'GET',
            headers: {
                referer: `${MANGA_KIMI_DOMAIN}/`,
                'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
            }
        })
    }

    async getCloudflareBypassRequestAsync(): Promise<Request> {
        return this.getCloudflareBypassRequest()
    }

    /**
     * Fetches metadata and details for a manga title
     */
    override async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request: Request = App.createRequest({
            url: `${MANGA_KIMI_DOMAIN}/manga/${mangaId}/`,
            method: 'GET'
        })

        const response: Response = await this.requestManager.schedule(request, 1)
        const $ = cheerio.load(response.data)

        return MangaKimiParser.parseMangaDetails($, mangaId)
    }

    /**
     * Fetches all chapters available for a manga title
     */
    override async getChapters(mangaId: string): Promise<Chapter[]> {
        const request: Request = App.createRequest({
            url: `${MANGA_KIMI_DOMAIN}/manga/${mangaId}/`,
            method: 'GET'
        })

        const response: Response = await this.requestManager.schedule(request, 1)
        const $ = cheerio.load(response.data)

        return MangaKimiParser.parseChapterList($, mangaId)
    }

    /**
     * Fetches page images for a chapter
     */
    override async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request: Request = App.createRequest({
            url: `${MANGA_KIMI_DOMAIN}/${chapterId}/`,
            method: 'GET'
        })

        const response: Response = await this.requestManager.schedule(request, 1)
        const html = response.data
        const $ = cheerio.load(html)

        return MangaKimiParser.parseChapterDetails(html, mangaId, chapterId, $)
    }

    /**
     * Generates sections shown on the Paperback home discovery screen
     */
    override async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        // 1. Popular Section
        const popularSection = App.createHomeSection({
            id: 'popular',
            title: 'ยอดนิยม (Popular Manga)',
            containsMoreItems: true,
            type: HomeSectionType.singleRowNormal
        })

        // 2. Latest Updates Section
        const latestSection = App.createHomeSection({
            id: 'latest',
            title: 'มังงะอัพเดทล่าสุด (Latest Updates)',
            containsMoreItems: true,
            type: HomeSectionType.singleRowNormal
        })

        // 3. All Manga Section
        const allMangaSection = App.createHomeSection({
            id: 'all',
            title: 'มังงะทั้งหมด (All Manga)',
            containsMoreItems: true,
            type: HomeSectionType.singleRowNormal
        })

        sectionCallback(popularSection)
        sectionCallback(latestSection)
        sectionCallback(allMangaSection)

        try {
            // Fetch Homepage HTML
            const request: Request = App.createRequest({
                url: MANGA_KIMI_DOMAIN,
                method: 'GET'
            })

            const response: Response = await this.requestManager.schedule(request, 1)
            const $ = cheerio.load(response.data)

            // Parse Popular items
            try {
                const popularTiles = MangaKimiParser.parseMangaTiles($('.top10content, .hothome'))
                if (popularTiles.length > 0) {
                    popularSection.items = popularTiles
                    sectionCallback(popularSection)
                }
            } catch (e) {
                console.log('Error parsing popular:', e)
            }

            // Parse Latest Update items
            try {
                const latestTiles = MangaKimiParser.parseMangaTiles($('.postbody .bixbox:not(.hothome)'))
                if (latestTiles.length > 0) {
                    latestSection.items = latestTiles
                    sectionCallback(latestSection)
                }
            } catch (e) {
                console.log('Error parsing latest:', e)
            }

            // Fetch All Manga
            try {
                const allRequest: Request = App.createRequest({
                    url: `${MANGA_KIMI_DOMAIN}/manga/?order=latest`,
                    method: 'GET'
                })
                const allResponse: Response = await this.requestManager.schedule(allRequest, 1)
                const all$ = cheerio.load(allResponse.data)
                const allTiles = MangaKimiParser.parseMangaTiles(all$)
                if (allTiles.length > 0) {
                    allMangaSection.items = allTiles
                    sectionCallback(allMangaSection)
                }
            } catch (e) {
                console.log('Error parsing all manga:', e)
            }
        } catch (err) {
            console.log('Error loading homepage:', err)
        }
    }

    /**
     * Handles clicking "View More" on any home section
     */
    override async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        let url = ''

        switch (homepageSectionId) {
            case 'popular':
                url = `${MANGA_KIMI_DOMAIN}/manga/?page=${page}&order=popular`
                break
            case 'latest':
                url = `${MANGA_KIMI_DOMAIN}/manga/?page=${page}&order=update`
                break
            case 'all':
            default:
                url = `${MANGA_KIMI_DOMAIN}/manga/?page=${page}&order=latest`
                break
        }

        const request: Request = App.createRequest({
            url,
            method: 'GET'
        })

        const response: Response = await this.requestManager.schedule(request, 1)
        const $ = cheerio.load(response.data)
        const items = MangaKimiParser.parseMangaTiles($)

        return App.createPagedResults({
            results: items,
            metadata: MangaKimiParser.hasNextPage($) ? { page: page + 1 } : undefined
        })
    }

    /**
     * Handles search queries from the user
     */
    override async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        let url = ''

        if (query.title) {
            url = `${MANGA_KIMI_DOMAIN}/page/${page}/?s=${encodeURIComponent(query.title)}`
        } else {
            url = `${MANGA_KIMI_DOMAIN}/manga/?page=${page}&order=latest`
        }

        const request: Request = App.createRequest({
            url,
            method: 'GET'
        })

        const response: Response = await this.requestManager.schedule(request, 1)
        const $ = cheerio.load(response.data)
        const items = MangaKimiParser.parseMangaTiles($)

        return App.createPagedResults({
            results: items,
            metadata: MangaKimiParser.hasNextPage($) ? { page: page + 1 } : undefined
        })
    }
}
