/**
 * Timezone formatting utilities.
 * All dates stored as UTC are displayed in the user's configured timezone.
 */

/** Common timezone options with friendly labels */
export const TIMEZONE_OPTIONS = [
	{ label: "UTC", value: "UTC" },
	{ label: "Eastern Time (US)", value: "America/New_York" },
	{ label: "Central Time (US)", value: "America/Chicago" },
	{ label: "Mountain Time (US)", value: "America/Denver" },
	{ label: "Pacific Time (US)", value: "America/Los_Angeles" },
	{ label: "Alaska Time", value: "America/Anchorage" },
	{ label: "Hawaii Time", value: "Pacific/Honolulu" },
	{ label: "London (GMT/BST)", value: "Europe/London" },
	{ label: "Central European", value: "Europe/Berlin" },
	{ label: "Eastern European", value: "Europe/Bucharest" },
	{ label: "India (IST)", value: "Asia/Kolkata" },
	{ label: "China (CST)", value: "Asia/Shanghai" },
	{ label: "Japan (JST)", value: "Asia/Tokyo" },
	{ label: "Australia Eastern", value: "Australia/Sydney" },
	{ label: "New Zealand", value: "Pacific/Auckland" },
	{ label: "São Paulo", value: "America/Sao_Paulo" },
] as const;

/**
 * Format an ISO date string as a localized date+time in the given timezone.
 */
export function formatDateTime(
	isoString: string | undefined | null,
	timezone: string,
	options?: Intl.DateTimeFormatOptions,
): string {
	if (!isoString) return "";
	try {
		return new Date(isoString).toLocaleString("en-US", {
			timeZone: timezone,
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
			...options,
		});
	} catch {
		// Fallback if timezone is invalid
		return new Date(isoString).toLocaleString();
	}
}

/**
 * Format an ISO date string as just the time in the given timezone.
 */
export function formatTime(
	isoString: string | undefined | null,
	timezone: string,
	options?: Intl.DateTimeFormatOptions,
): string {
	if (!isoString) return "";
	try {
		return new Date(isoString).toLocaleTimeString("en-US", {
			timeZone: timezone,
			hour: "numeric",
			minute: "2-digit",
			...options,
		});
	} catch {
		return new Date(isoString).toLocaleTimeString();
	}
}

/**
 * Format an ISO date string as just the date in the given timezone.
 */
export function formatDate(
	isoString: string | undefined | null,
	timezone: string,
	options?: Intl.DateTimeFormatOptions,
): string {
	if (!isoString) return "";
	try {
		return new Date(isoString).toLocaleDateString("en-US", {
			timeZone: timezone,
			month: "short",
			day: "numeric",
			...options,
		});
	} catch {
		return new Date(isoString).toLocaleDateString();
	}
}
