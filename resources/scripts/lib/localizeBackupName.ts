import { format, parse } from 'date-fns';

/**
 * Localizes backup names that contain UTC timestamps.
 * Converts "Backup at 2025-11-06 09:43:40" from UTC to user's local timezone.
 */
export function localizeBackupName(name: string): string {
    // Match pattern: "Backup at YYYY-MM-DD HH:mm:ss"
    const match = name.match(/^Backup at (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})$/);

    if (!match) {
        // Not an auto-generated backup name, return as-is
        return name;
    }

    try {
        // Parse the UTC timestamp
        const utcTimestamp = match[1];
        const utcDate = parse(utcTimestamp, 'yyyy-MM-dd HH:mm:ss', new Date());

        // Assume the timestamp from backend is in UTC
        // JavaScript Date constructor treats this as local time, so we need to adjust
        const utcTime = Date.UTC(
            utcDate.getFullYear(),
            utcDate.getMonth(),
            utcDate.getDate(),
            utcDate.getHours(),
            utcDate.getMinutes(),
            utcDate.getSeconds()
        );

        // Create Date object in UTC then format in local timezone
        const localDate = new Date(utcTime);
        const localTimestamp = format(localDate, 'yyyy-MM-dd HH:mm:ss');

        return `Backup at ${localTimestamp}`;
    } catch (e) {
        // If parsing fails, return original name
        console.warn('Failed to parse backup timestamp:', e);
        return name;
    }
}
