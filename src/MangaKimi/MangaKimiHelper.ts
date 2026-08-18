export const MANGA_KIMI_DOMAIN = 'https://www.mangakimi.com'

/**
 * Normalizes and cleans relative/malformed URLs to absolute HTTPS URLs
 */
export function cleanUrl(url: string | undefined): string {
    if (!url) return ''
    let cleaned = url.trim()
    if (cleaned.startsWith('//')) {
        cleaned = 'https:' + cleaned
    } else if (cleaned.startsWith('/')) {
        cleaned = MANGA_KIMI_DOMAIN + cleaned
    }
    return encodeURI(decodeURI(cleaned))
}

/**
 * Parses chapter title/string to numerical float
 * e.g. "ตอนที่ 105", "ตอนที่ 12.5", "Chapter 4"
 */
export function parseChapterNumber(chapterStr: string): number {
    if (!chapterStr) return 1

    const match = chapterStr.match(/(\d+(\.\d+)?)/)
    if (match && match[1]) {
        return parseFloat(match[1])
    }
    return 1
}

/**
 * Parses Thai date formats
 */
export function parseThaiDate(dateStr: string): Date {
    if (!dateStr) return new Date()

    const cleanDate = dateStr.trim().toLowerCase()
    const now = new Date()

    // Relative timestamps
    if (cleanDate.includes('วินาที') || cleanDate.includes('second')) return now
    if (cleanDate.includes('นาที') || cleanDate.includes('minute')) {
        const mins = parseInt(cleanDate) || 1
        return new Date(now.getTime() - mins * 60 * 1000)
    }
    if (cleanDate.includes('ชั่วโมง') || cleanDate.includes('hour')) {
        const hours = parseInt(cleanDate) || 1
        return new Date(now.getTime() - hours * 60 * 60 * 1000)
    }
    if (cleanDate.includes('วัน') || cleanDate.includes('day')) {
        const days = parseInt(cleanDate) || 1
        return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    }

    // Thai month mappings
    const thaiMonths: { [key: string]: number } = {
        'มกราคม': 0, 'ม.ค.': 0, 'ม.ค': 0,
        'กุมภาพันธ์': 1, 'ก.พ.': 1, 'ก.พ': 1,
        'มีนาคม': 2, 'มี.ค.': 2, 'มี.ค': 2,
        'เมษายน': 3, 'เม.ย.': 3, 'เม.ย': 3,
        'พฤษภาคม': 4, 'พ.ค.': 4, 'พ.ค': 4,
        'มิถุนายน': 5, 'มิ.ย.': 5, 'มิ.ย': 5,
        'กรกฎาคม': 6, 'ก.ค.': 6, 'ก.ค': 6,
        'สิงหาคม': 7, 'ส.ค.': 7, 'ส.ค': 7,
        'กันยายน': 8, 'ก.ย.': 8, 'ก.ย': 8,
        'ตุลาคม': 9, 'ต.ค.': 9, 'ต.ค': 9,
        'พฤศจิกายน': 10, 'พ.ย.': 10, 'พ.ย': 10,
        'ธันวาคม': 11, 'ธ.ค.': 11, 'ธ.ค': 11
    }

    const parts = cleanDate.split(/[\s,/-]+/)
    if (parts.length >= 3) {
        let day = parseInt(parts[0]) || 1
        let monthStr = parts[1]
        let year = parseInt(parts[2]) || now.getFullYear()

        // Handle Buddhist Era years (e.g. 2567 -> 2024)
        if (year > 2400) {
            year -= 543
        }

        let month = 0
        for (const [tMonth, index] of Object.entries(thaiMonths)) {
            if (monthStr.includes(tMonth.toLowerCase())) {
                month = index
                break
            }
        }

        const parsedDate = new Date(year, month, day)
        if (!isNaN(parsedDate.getTime())) {
            return parsedDate
        }
    }

    const standardDate = new Date(dateStr)
    return isNaN(standardDate.getTime()) ? now : standardDate
}
