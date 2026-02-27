/**
 * Utility for safe date parsing and formatting across the application.
 */

/**
 * Parses a date string in the format "DD/MM/YYYY, HH:MM" or variations.
 * @param dateStr The date string to parse
 * @returns Date object or null if invalid
 */
export const parseVestingDate = (dateStr: any): Date | null => {
    if (!dateStr || (typeof dateStr === 'string' && dateStr.includes('dd/mm/yyyy'))) return null;

    // Handle number (timestamp)
    if (typeof dateStr === 'number') {
        const ms = dateStr < 10000000000 ? dateStr * 1000 : dateStr;
        return new Date(ms);
    }

    if (typeof dateStr !== 'string') return null;

    try {
        // Normalizes string: remove commas, extra spaces
        const cleanStr = dateStr.replace(',', ' ').replace(/\s+/g, ' ').trim();
        const parts = cleanStr.split(' ');

        if (parts.length < 2) {
            // ISO format or date-only fallback
            if (dateStr.includes('-')) return new Date(dateStr);
            if (dateStr.includes('/')) {
                const [d, m, y] = dateStr.split('/').map(Number);
                if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m - 1, d);
            }
            return null;
        }

        const datePart = parts[0];
        const timePart = parts[1];
        const ampm = parts[2]?.toUpperCase(); // handle "12:43 AM"

        const [day, month, year] = datePart.split('/').map(Number);

        // Clean non-digits from time part (e.g. handle "12:43:00")
        const [hRaw, mRaw] = timePart.split(':');
        let hour = parseInt(hRaw);
        let minute = parseInt(mRaw);

        if (ampm === 'PM' && hour < 12) hour += 12;
        if (ampm === 'AM' && hour === 12) hour = 0;

        if (isNaN(day) || isNaN(month) || isNaN(year) || isNaN(hour) || isNaN(minute)) {
            // Final fallback to JS native parser if it looks like an ISO string or similar
            const native = new Date(dateStr);
            return isNaN(native.getTime()) ? null : native;
        }

        return new Date(year, month - 1, day, hour, minute);
    } catch (e) {
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

    // Case for blockchain contracts where duration is already in seconds
    if (contract.onChain || (typeof contract.vestingDuration === 'number' && !contract.selectedTimeUnit)) {
        const end = start + (contract.vestingDuration * 1000);
        if (nowMillis >= end) return 1;
        if (end <= start) return 1;

        if (contract.selectedSchedule && contract.selectedSchedule.toLowerCase().includes('cliff')) {
            if (nowMillis < start) return 0;
            const cliffPercentage = parseInt(contract.cliffAmount || "0") / 100;
            const linearProgress = (nowMillis - start) / (end - start);
            return cliffPercentage + ((1 - cliffPercentage) * linearProgress);
        }

        const rawP = (nowMillis - start) / (end - start);
        return Math.min(1, Math.max(0, rawP));
    }

    // Default logic (UI Drafts / Local Storage)
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

    if (contract.selectedSchedule && contract.selectedSchedule.toLowerCase().includes('cliff')) {
        if (nowMillis < start) return 0;
        const cliffPercentage = parseInt(contract.cliffAmount || "0") / 100;
        const linearProgress = (nowMillis - start) / (end - start);
        return cliffPercentage + ((1 - cliffPercentage) * linearProgress);
    }

    const rawP = (nowMillis - start) / (end - start);
    return Math.min(1, Math.max(0, rawP));
};
