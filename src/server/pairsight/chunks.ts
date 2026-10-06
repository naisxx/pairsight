// A list a batch at a time, for writes too big for one statement (Postgres
// takes at most 65,535 values per statement) or one round trip.
export function* chunks<T>(items: readonly T[], size: number): Generator<T[]> {
	for (let start = 0; start < items.length; start += size) yield items.slice(start, start + size)
}
