export function getFilename(at: Date): string {
	return `polls-v2/${at.getFullYear()}/${at.getUTCMonth() + 1}/${at.getUTCDate()}/${at.toISOString()}.json.gz`;
}
