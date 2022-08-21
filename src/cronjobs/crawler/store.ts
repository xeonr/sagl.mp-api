export function getFilename(at: Date): string {
	return `newcrawler/${at.getFullYear()}/${at.getUTCMonth() + 1}/${at.getUTCDate()}/${at.toISOString()}.json.gz`;
}
