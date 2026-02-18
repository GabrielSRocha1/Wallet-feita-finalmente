/**
 * Utility for safe date parsing and formatting across the application.
 */

/**
 * Parses a date string in the format "DD/MM/YYYY, HH:MM" or variations.
 * @param dateStr The date string to parse
 * @returns Date object or null if invalid
 */
export const parseVestingDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr || typeof dateStr !== 'string' || dateStr.includes('dd/mm/yyyy')) return null;

    try {
        // Normalizes variations (some might use "/" or "-" or have/not have comma)
        const normalized = dateStr.replace(',', ' ').replace('  ', ' ').trim();
        const parts = normalized.split(' ');

        if (parts.length < 2) {
            // Check if it's just a date without time
            if (dateStr.includes('/')) {
                const [d, m, y] = dateStr.split('/').map(Number);
                if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m - 1, d);
            }
            return null;
        }

        const datePart = parts[0];
        const timePart = parts[1];

        const [day, month, year] = datePart.split('/').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);

        if (isNaN(day) || isNaN(month) || isNaN(year) || isNaN(hour) || isNaN(minute)) {
            return null;
        }

        return new Date(year, month - 1, day, hour, minute);
    } catch (e) {
        console.error("[DateUtils] Error parsing date:", dateStr, e);
        return null;
    }
};

/**
 * Formats a Date object to "DD/MM/YYYY, HH:MM"
 */
export const formatVestingDate = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');

    return `${day}/${month}/${year}, ${hour}:${minute}`;
};
