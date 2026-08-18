import {
    Chapter,
    ChapterDetails,
    MangaTile,
    SourceManga,
    Tag,
    TagSection
} from '@paperback/types'
import {
    decryptChapterPayload,
    getCoverUrl,
    getPageImageUrl
} from './NekoPostHelper'

export class NekoPostParser {

    /**
     * Parses manga tiles from latest chapters list (/api/project/latest)
     */
    static parseLatestTiles(listChapter: any[]): MangaTile[] {
        const tiles: MangaTile[] = []
        if (!Array.isArray(listChapter)) return tiles

        const seenProjects = new Set<number>()

        for (const item of listChapter) {
            const pid = item.pid || item.projectId
            if (!pid || seenProjects.has(pid)) continue
            seenProjects.add(pid)

            const title = item.projectName || `Project ${pid}`
            const image = getCoverUrl(pid, item.coverVersion)
            const subtitle = item.chapterNo ? `ตอนที่ ${item.chapterNo}` : undefined

            tiles.push(
                App.createMangaTile({
                    id: String(pid),
                    image,
                    title: App.createIconText({ text: title }),
                    subtitleText: subtitle ? App.createIconText({ text: subtitle }) : undefined
                })
            )
        }

        return tiles
    }

    /**
     * Parses manga tiles from popular/search project list
     */
    static parseProjectTiles(listProject: any[]): MangaTile[] {
        const tiles: MangaTile[] = []
        if (!Array.isArray(listProject)) return tiles

        for (const item of listProject) {
            const pid = item.pid || item.projectId
            if (!pid) continue

            const title = item.projectName || `Project ${pid}`
            const image = getCoverUrl(pid, item.coverVersion)
            const subtitle = item.noChapter ? `${item.noChapter} ตอน` : undefined

            tiles.push(
                App.createMangaTile({
                    id: String(pid),
                    image,
                    title: App.createIconText({ text: title }),
                    subtitleText: subtitle ? App.createIconText({ text: subtitle }) : undefined
                })
            )
        }

        return tiles
    }

    /**
     * Parses full manga details from /api/project/detail2
     */
    static parseMangaDetails(data: any, mangaId: string): SourceManga {
        const project = data?.projectInfo?.Project || {}
        const listCate = data?.projectInfo?.ListCate || []

        const title = project.projectName || `Project ${mangaId}`
        const image = getCoverUrl(Number(mangaId), project.coverVersion)
        const author = project.authorName || undefined
        const artist = project.artistName || undefined
        const description = project.info || ''
        const status = project.status === 1 ? 'Ongoing' : 'Completed'

        const tags: Tag[] = []
        for (const cat of listCate) {
            const catName = cat.cateName || cat.name || cat.CateName
            const catId = String(cat.cateId || cat.id || cat.CateID || catName)
            if (catName) {
                tags.push(App.createTag({ id: catId, label: catName }))
            }
        }

        // Add concatCate if available
        if (project.concatCate) {
            const extraTags = project.concatCate.split(',').map((s: string) => s.trim()).filter(Boolean)
            for (const t of extraTags) {
                if (!tags.some(x => x.label.toLowerCase() === t.toLowerCase())) {
                    tags.push(App.createTag({ id: t.toLowerCase(), label: t }))
                }
            }
        }

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
                image,
                status,
                author,
                artist,
                desc: description,
                tags: tagSections,
                rating: project.views ? Math.min(10, Math.max(1, Math.log10(project.views))) : undefined
            })
        })
    }

    /**
     * Parses chapter list from /api/project/detail2
     */
    static parseChapterList(data: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        const listChapter = data?.projectInfo?.ListChapter || []

        for (const item of listChapter) {
            const chapterId = String(item.ChapterID || item.chapterId || item.id)
            if (!chapterId) continue

            const chapNum = item.ChapterNo ? parseFloat(item.ChapterNo) : 1
            const name = item.ChapterName || `ตอนที่ ${chapNum}`
            
            let time: Date = new Date()
            if (item.PublishDate?.String) {
                time = new Date(item.PublishDate.String)
            } else if (item.CreateDate?.String) {
                time = new Date(item.CreateDate.String)
            }

            chapters.push(
                App.createChapter({
                    id: chapterId,
                    chapNum: isNaN(chapNum) ? 1 : chapNum,
                    name,
                    time: isNaN(time.getTime()) ? new Date() : time,
                    langCode: 'th'
                })
            )
        }

        return chapters
    }

    /**
     * Parses decrypted chapter image pages
     */
    static parseChapterDetails(encryptedText: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        const decrypted = decryptChapterPayload(encryptedText)

        if (decrypted?.pageItem && Array.isArray(decrypted.pageItem)) {
            // Sort pages by pageNo ascending
            const sortedPages = decrypted.pageItem.sort((a: any, b: any) => {
                return (parseInt(a.pageNo) || 0) - (parseInt(b.pageNo) || 0)
            })

            const pid = Number(mangaId)
            for (const page of sortedPages) {
                const fileName = page.fileName || page.pageName
                if (fileName) {
                    pages.push(getPageImageUrl(pid, chapterId, fileName))
                }
            }
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId,
            pages
        })
    }
}
