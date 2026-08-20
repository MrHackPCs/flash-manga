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
import { SNAP_MANGA_DOMAIN } from './SnapMangaHelper'
import { SnapMangaParser } from './SnapMangaParser'

// Ensure App.createCheerioAPI is always available if anything calls it
if (typeof App !== 'undefined' && !App.createCheerioAPI) {
    App.createCheerioAPI = (html: string) => cheerio.load(html)
}

export const SnapMangaInfo: SourceInfo = {
    version: '1.0.0',
    name: 'Snap-Manga',
    icon: 'icon.png',
    author: 'Paperback Community',
    authorWebsite: 'https://github.com',
    description: 'Extension that scrapes manga from snap-manga.com (Thai translation)',
    contentRating: ContentRating.EVERYONE,
    websiteBaseURL: SNAP_MANGA_DOMAIN,
    sourceIntents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.MANGA_SEARCH | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED
}

export class SnapManga extends Source {
    requestManager = App.createRequestManager({
        requestsPerSecond: 4,
        requestTimeout: 20000
    })

    override getMangaShareUrl(mangaId: string): string {
        return `${SNAP_MANGA_DOMAIN}/manga/${mangaId}/`
    }

    /**
     * Cloudflare Bypass Request
     */
    getCloudflareBypassRequest(): Request {
        return App.createRequest({
            url: SNAP_MANGA_DOMAIN,
            method: 'GET',
            headers: {
                referer: `${SNAP_MANGA_DOMAIN}/`,
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
            url: `${SNAP_MANGA_DOMAIN}/manga/${mangaId}/`,
            method: 'GET'
        })

        const response: Response = await this.requestManager.schedule(request, 1)
        const $ = cheerio.load(response.data)

        return SnapMangaParser.parseMangaDetails($, mangaId)
    }

    /**
     * Fetches all chapters available for a manga title
     */
    override async getChapters(mangaId: string): Promise<Chapter[]> {
        const request: Request = App.createRequest({
            url: `${SNAP_MANGA_DOMAIN}/manga/${mangaId}/`,
            method: 'GET'
        })

        const response: Response = await this.requestManager.schedule(request, 1)
        let $ = cheerio.load(response.data)
        let chapters = SnapMangaParser.parseChapterList($, mangaId)

        // If no chapters found in initial HTML, try AJAX endpoint (Madara)
        if (chapters.length === 0) {
            try {
                const ajaxRequest: Request = App.createRequest({
                    url: `${SNAP_MANGA_DOMAIN}/manga/${mangaId}/ajax/chapters/`,
                    method: 'POST'
                })
                const ajaxResponse: Response = await this.requestManager.schedule(ajaxRequest, 1)
                $ = cheerio.load(ajaxResponse.data)
                chapters = SnapMangaParser.parseChapterList($, mangaId)
            } catch (err) {
                console.log('Error fetching ajax chapters:', err)
            }
        }

        return chapters
    }

    /**
     * Fetches page images for a chapter
     */
    override async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const encodedChapter = encodeURIComponent(chapterId)
        let request: Request = App.createRequest({
            url: `${SNAP_MANGA_DOMAIN}/manga/${mangaId}/${encodedChapter}/`,
            method: 'GET'
        })

        let response: Response
        try {
            response = await this.requestManager.schedule(request, 1)
        } catch (err) {
            request = App.createRequest({
                url: `${SNAP_MANGA_DOMAIN}/${encodedChapter}/`,
                method: 'GET'
            })
            response = await this.requestManager.schedule(request, 1)
        }

        const html = response.data
        const $ = cheerio.load(html)

        return SnapMangaParser.parseChapterDetails(html, mangaId, chapterId, $)
    }

    /**
     * Generates sections shown on the Paperback home discovery screen
     */
    override async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        // 1. Popular Section
        const popularSection = App.createHomeSection({
            id: 'popular',
            title: 'อันดับยอดฮิต (Most Popular)',
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
            // 1. Fetch Popular items
            try {
                const popReq: Request = App.createRequest({
                    url: `${SNAP_MANGA_DOMAIN}/manga/?m_orderby=views`,
                    method: 'GET'
                })
                const popRes: Response = await this.requestManager.schedule(popReq, 1)
                const pop$ = cheerio.load(popRes.data)
                const popTiles = SnapMangaParser.parseMangaTiles(pop$)
                if (popTiles.length > 0) {
                    popularSection.items = popTiles
                    sectionCallback(popularSection)
                }
            } catch (e) {
                console.log('Error parsing popular section:', e)
            }

            // 2. Fetch Latest items from homepage
            try {
                const hpReq: Request = App.createRequest({
                    url: SNAP_MANGA_DOMAIN,
                    method: 'GET'
                })
                const hpRes: Response = await this.requestManager.schedule(hpReq, 1)
                const hp$ = cheerio.load(hpRes.data)
                const latestTiles = SnapMangaParser.parseMangaTiles(hp$)
                if (latestTiles.length > 0) {
                    latestSection.items = latestTiles
                    sectionCallback(latestSection)
                }
            } catch (e) {
                console.log('Error parsing latest section:', e)
            }

            // 3. Fetch All Manga
            try {
                const allRequest: Request = App.createRequest({
                    url: `${SNAP_MANGA_DOMAIN}/manga/?m_orderby=latest`,
                    method: 'GET'
                })
                const allResponse: Response = await this.requestManager.schedule(allRequest, 1)
                const all$ = cheerio.load(allResponse.data)
                const allTiles = SnapMangaParser.parseMangaTiles(all$)
                if (allTiles.length > 0) {
                    allMangaSection.items = allTiles
                    sectionCallback(allMangaSection)
                }
            } catch (e) {
                console.log('Error parsing all manga section:', e)
            }
        } catch (err) {
            console.log('Error loading homepage sections:', err)
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
                url = page > 1
                    ? `${SNAP_MANGA_DOMAIN}/manga/page/${page}/?m_orderby=views`
                    : `${SNAP_MANGA_DOMAIN}/manga/?m_orderby=views`
                break
            case 'latest':
                url = page > 1
                    ? `${SNAP_MANGA_DOMAIN}/manga/page/${page}/?m_orderby=latest`
                    : `${SNAP_MANGA_DOMAIN}/manga/?m_orderby=latest`
                break
            case 'all':
            default:
                url = page > 1
                    ? `${SNAP_MANGA_DOMAIN}/manga/page/${page}/?m_orderby=alphabet`
                    : `${SNAP_MANGA_DOMAIN}/manga/?m_orderby=alphabet`
                break
        }

        const request: Request = App.createRequest({
            url,
            method: 'GET'
        })

        const response: Response = await this.requestManager.schedule(request, 1)
        const $ = cheerio.load(response.data)
        const items = SnapMangaParser.parseMangaTiles($)

        return App.createPagedResults({
            results: items,
            metadata: SnapMangaParser.hasNextPage($) ? { page: page + 1 } : undefined
        })
    }

    /**
     * Handles search queries from the user
     */
    override async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        let url = ''

        if (query.title) {
            url = page > 1
                ? `${SNAP_MANGA_DOMAIN}/page/${page}/?s=${encodeURIComponent(query.title)}&post_type=wp-manga`
                : `${SNAP_MANGA_DOMAIN}/?s=${encodeURIComponent(query.title)}&post_type=wp-manga`
        } else {
            url = page > 1
                ? `${SNAP_MANGA_DOMAIN}/manga/page/${page}/?m_orderby=latest`
                : `${SNAP_MANGA_DOMAIN}/manga/?m_orderby=latest`
        }

        const request: Request = App.createRequest({
            url,
            method: 'GET'
        })

        const response: Response = await this.requestManager.schedule(request, 1)
        const $ = cheerio.load(response.data)
        const items = SnapMangaParser.parseMangaTiles($)

        return App.createPagedResults({
            results: items,
            metadata: SnapMangaParser.hasNextPage($) ? { page: page + 1 } : undefined
        })
    }
}
