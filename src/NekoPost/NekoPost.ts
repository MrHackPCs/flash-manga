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
import {
    NEKOPOST_API_DOMAIN,
    NEKOPOST_DOMAIN
} from './NekoPostHelper'
import { NekoPostParser } from './NekoPostParser'

export const NekoPostInfo: SourceInfo = {
    version: '1.0.0',
    name: 'NekoPost',
    icon: 'icon.png',
    author: 'Paperback Community',
    authorWebsite: 'https://github.com',
    description: 'Extension that pulls manga from nekopost.net (Thai translation & community)',
    contentRating: ContentRating.EVERYONE,
    websiteBaseURL: NEKOPOST_DOMAIN,
    sourceIntents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.MANGA_SEARCH | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED
}

export class NekoPost extends Source {
    requestManager = App.createRequestManager({
        requestsPerSecond: 4,
        requestTimeout: 20000
    })

    override getMangaShareUrl(mangaId: string): string {
        return `${NEKOPOST_DOMAIN}/manga/${mangaId}`
    }

    /**
     * Cloudflare Bypass Request
     */
    getCloudflareBypassRequest(): Request {
        return App.createRequest({
            url: NEKOPOST_DOMAIN,
            method: 'GET',
            headers: {
                referer: `${NEKOPOST_DOMAIN}/`,
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
            url: `${NEKOPOST_API_DOMAIN}/project/detail2`,
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            data: JSON.stringify({ pid: Number(mangaId) })
        })

        const response: Response = await this.requestManager.schedule(request, 1)
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data

        return NekoPostParser.parseMangaDetails(data, mangaId)
    }

    /**
     * Fetches all chapters available for a manga title
     */
    override async getChapters(mangaId: string): Promise<Chapter[]> {
        const request: Request = App.createRequest({
            url: `${NEKOPOST_API_DOMAIN}/project/detail2`,
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            data: JSON.stringify({ pid: Number(mangaId) })
        })

        const response: Response = await this.requestManager.schedule(request, 1)
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data

        return NekoPostParser.parseChapterList(data, mangaId)
    }

    /**
     * Fetches page images for a chapter
     */
    override async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request: Request = App.createRequest({
            url: `${NEKOPOST_DOMAIN}/handler/cinfo`,
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            data: JSON.stringify({
                p: Number(mangaId),
                c: Number(chapterId)
            })
        })

        const response: Response = await this.requestManager.schedule(request, 1)
        const encryptedText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data)

        return NekoPostParser.parseChapterDetails(encryptedText, mangaId, chapterId)
    }

    /**
     * Generates sections shown on the Paperback home discovery screen
     */
    override async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        // 1. Popular Manga Section
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

        sectionCallback(popularSection)
        sectionCallback(latestSection)

        // 1. Fetch Popular Projects
        try {
            const popularRequest: Request = App.createRequest({
                url: `${NEKOPOST_API_DOMAIN}/project/list/popular`,
                method: 'POST',
                headers: {
                    'content-type': 'application/json'
                },
                data: JSON.stringify({
                    type: 'm',
                    paging: { pageNo: 1, pageSize: 20 }
                })
            })

            const popularResponse: Response = await this.requestManager.schedule(popularRequest, 1)
            const popData = typeof popularResponse.data === 'string' ? JSON.parse(popularResponse.data) : popularResponse.data
            const popTiles = NekoPostParser.parseProjectTiles(popData.listProject)
            if (popTiles.length > 0) {
                popularSection.items = popTiles
                sectionCallback(popularSection)
            }
        } catch (e) {
            console.log('Error loading popular sections:', e)
        }

        // 2. Fetch Latest Chapters
        try {
            const latestRequest: Request = App.createRequest({
                url: `${NEKOPOST_API_DOMAIN}/project/latest`,
                method: 'POST',
                headers: {
                    'content-type': 'application/json'
                },
                data: JSON.stringify({
                    type: 'm',
                    paging: { pageNo: 1, pageSize: 20 }
                })
            })

            const latestResponse: Response = await this.requestManager.schedule(latestRequest, 1)
            const latData = typeof latestResponse.data === 'string' ? JSON.parse(latestResponse.data) : latestResponse.data
            const latTiles = NekoPostParser.parseLatestTiles(latData.listChapter)
            if (latTiles.length > 0) {
                latestSection.items = latTiles
                sectionCallback(latestSection)
            }
        } catch (e) {
            console.log('Error loading latest sections:', e)
        }
    }

    /**
     * Handles clicking "View More" on any home section
     */
    override async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1

        if (homepageSectionId === 'popular') {
            const request: Request = App.createRequest({
                url: `${NEKOPOST_API_DOMAIN}/project/list/popular`,
                method: 'POST',
                headers: {
                    'content-type': 'application/json'
                },
                data: JSON.stringify({
                    type: 'm',
                    paging: { pageNo: page, pageSize: 20 }
                })
            })

            const response: Response = await this.requestManager.schedule(request, 1)
            const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
            const items = NekoPostParser.parseProjectTiles(data.listProject)

            return App.createPagedResults({
                results: items,
                metadata: items.length >= 20 ? { page: page + 1 } : undefined
            })
        } else {
            const request: Request = App.createRequest({
                url: `${NEKOPOST_API_DOMAIN}/project/latest`,
                method: 'POST',
                headers: {
                    'content-type': 'application/json'
                },
                data: JSON.stringify({
                    type: 'm',
                    paging: { pageNo: page, pageSize: 20 }
                })
            })

            const response: Response = await this.requestManager.schedule(request, 1)
            const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
            const items = NekoPostParser.parseLatestTiles(data.listChapter)

            return App.createPagedResults({
                results: items,
                metadata: items.length >= 20 ? { page: page + 1 } : undefined
            })
        }
    }

    /**
     * Handles search queries from the user
     */
    override async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1

        const request: Request = App.createRequest({
            url: `${NEKOPOST_API_DOMAIN}/project/search`,
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            data: JSON.stringify({
                keyword: query.title || '',
                genre: [],
                status: 0,
                specialType: [],
                orderBy: 'latest',
                paging: { pageNo: page, pageSize: 20 }
            })
        })

        const response: Response = await this.requestManager.schedule(request, 1)
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
        const items = NekoPostParser.parseProjectTiles(data.listProject)

        return App.createPagedResults({
            results: items,
            metadata: items.length >= 20 ? { page: page + 1 } : undefined
        })
    }
}
