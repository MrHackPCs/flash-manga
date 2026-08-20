import CryptoJS from 'crypto-js'

export const NEKOPOST_DOMAIN = 'https://www.nekopost.net'
export const NEKOPOST_MANGA_URL = 'https://www.nekopost.net/manga'
export const NEKOPOST_API_DOMAIN = 'https://www.nekopost.net/api'
export const NEKOPOST_AES_KEY = 'AeyTest'

/**
 * Returns the CDN base URL depending on project ID (threshold 17500)
 */
export function getCdnBase(projectId: number): string {
    return projectId > 17500 ? 'https://fs.osemocphoto.com/collectManga/' : 'https://www.osemocphoto.com/collectManga/'
}

/**
 * Constructs the manga cover image URL
 */
export function getCoverUrl(projectId: number, coverVersion?: number): string {
    const base = getCdnBase(projectId)
    const verQuery = coverVersion ? `?ver=${coverVersion}` : ''
    return `${base}${projectId}/${projectId}_cover.jpg${verQuery}`
}

/**
 * Constructs the chapter page image URL
 */
export function getPageImageUrl(projectId: number, chapterId: number | string, fileName: string): string {
    const base = getCdnBase(projectId)
    return `${base}${projectId}/${chapterId}/${fileName}`
}

/**
 * Decrypts AES encrypted chapter payload from /handler/cinfo
 */
export function decryptChapterPayload(encryptedText: string): any {
    try {
        const decryptedStr = CryptoJS.AES.decrypt(encryptedText, NEKOPOST_AES_KEY).toString(CryptoJS.enc.Utf8)
        return JSON.parse(decryptedStr)
    } catch (err) {
        console.log('Error decrypting NekoPost chapter payload:', err)
        return null
    }
}
