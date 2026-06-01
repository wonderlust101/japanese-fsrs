export type GreetingTimeBucket = "morning" | "afternoon" | "evening" | "late";

export function getGreetingBucket(hour: number): GreetingTimeBucket {
	if (hour >= 5 && hour < 11)
		return "morning";
	if (hour >= 11 && hour < 17)
		return "afternoon";
	if (hour >= 17 && hour < 22)
		return "evening";
	return "late";
}

/**
 * `firstTime` swaps the late-night greeting away from おかえり ("welcome
 * back / welcome home"), which wrongly implies a return for someone opening
 * Tomo for the first time. The neutral こんばんは ("good evening") is used
 * instead. The day buckets are already return-neutral time greetings, so
 * only the late bucket needs to branch.
 */
export function getJapaneseGreeting(hour: number, firstTime = false): string {
	switch (getGreetingBucket(hour)) {
		case "morning": return "おはよう";
		case "afternoon": return "こんにちは";
		case "evening": return "こんばんは";
		case "late": return firstTime ? "こんばんは" : "おかえり";
	}
}

export function getEnglishWelcomeClause(bucket: GreetingTimeBucket): string {
	switch (bucket) {
		case "morning": return "Pour the coffee.";
		case "afternoon": return "Pull up a chair.";
		case "evening": return "The lamp is on.";
		case "late": return "One or two is plenty.";
	}
}
