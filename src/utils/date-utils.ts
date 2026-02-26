/**
 * Utility for safe date parsing and formatting across the application.
 */

/**
 * Parses a date string in the format "DD/MM/YYYY, HH:MM" or variations.
 * @param dateStr The date string to parse
 * @returns Date object or null if invalid
 */
export const parseVestingDate = (dateStr: any): Date | null => {
    if (!dateStr || dateStr.includes?.('dd/mm/yyyy')) return null;

    // Handle number (timestamp)
    if (typeof dateStr === 'number') {
        // Solana timestamps are in seconds. JS needs milliseconds.
        // If it's too small (e.g. year 1970/1971), it's probably seconds.
        const ms = dateStr < 10000000000 ? dateStr * 1000 : dateStr;
        return new Date(ms);
    }

    if (typeof dateStr !== 'string') return null;

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

/**
 * Calculates current progress (0 to 1) for a vesting contract, perfectly mirroring the on-chain logic 
 * generated in \`revisar/page.tsx\`. Supports both Linear and Cliff schedules.
 * @param contract The local contract data object
 * @param nowMillis Timestamp to calculate against (defaults to Date.now())
 */
export const calculateVestingProgress = (contract: any, nowMillis: number = Date.now()): number => {
    const startDate = parseVestingDate(contract.vestingStartDate);
    if (!startDate) return 0;

    const start = startDate.getTime();

    // Cliff logic: hybrid unlock (percentage at cliff date + linear remainder until end date)
    if (contract.selectedSchedule && contract.selectedSchedule.toLowerCase().includes('cliff')) {
        if (nowMillis < start) return 0;

        const cliffPercentage = parseInt(contract.cliffAmount || "0") / 100; // e.g., 0.1 for 10%

        const duration = parseInt(contract.vestingDuration || "1");
        const unit = (contract.selectedTimeUnit || "").toLowerCase();
        const endDateObj = new Date(start);
        if (unit.includes('dia')) endDateObj.setDate(endDateObj.getDate() + duration);
        else if (unit.includes('mês') || unit.includes('mes')) endDateObj.setMonth(endDateObj.getMonth() + duration);
        else if (unit.includes('ano')) endDateObj.setFullYear(endDateObj.getFullYear() + duration);
        else if (unit.includes('hora')) endDateObj.setHours(endDateObj.getHours() + duration);
        else if (unit.includes('semana')) endDateObj.setDate(endDateObj.getDate() + (duration * 7));
        else if (unit.includes('minuto')) endDateObj.setMinutes(endDateObj.getMinutes() + duration);

        const end = endDateObj.getTime();
        if (nowMillis >= end) return 1;
        if (end <= start) return 1;

        // Progress from 0 (at cliff date) to 1 (at end date)
        const linearProgress = (nowMillis - start) / (end - start);

        // Final progress = cliffPercentage + (remaining percentage * linear progress)
        return cliffPercentage + ((1 - cliffPercentage) * linearProgress);
    }

    // Linear logic
    const duration = parseInt(contract.vestingDuration || "1");
    const unit = (contract.selectedTimeUnit || "").toLowerCase();

    // Replicate exactly what `revisar/page.tsx` does for setting endDate
    const endDateObj = new Date(start);
    if (unit.includes('dia')) endDateObj.setDate(endDateObj.getDate() + duration);
    else if (unit.includes('mês') || unit.includes('mes')) endDateObj.setMonth(endDateObj.getMonth() + duration);
    else if (unit.includes('ano')) endDateObj.setFullYear(endDateObj.getFullYear() + duration);
    else if (unit.includes('hora')) endDateObj.setHours(endDateObj.getHours() + duration);
    else if (unit.includes('semana')) endDateObj.setDate(endDateObj.getDate() + (duration * 7));
    else if (unit.includes('minuto')) endDateObj.setMinutes(endDateObj.getMinutes() + duration);

    const end = endDateObj.getTime();
    if (end <= start) return 1;

    const rawP = (nowMillis - start) / (end - start);
    return Math.min(1, Math.max(0, rawP));
};
