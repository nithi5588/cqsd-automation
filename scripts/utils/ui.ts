const CODES = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	cyan: "\x1b[36m",
} as const;

export function color(text: string, code: keyof typeof CODES): string {
	return `${CODES[code]}${text}${CODES.reset}`;
}

export function section(title: string): void {
	console.log(`\n${color(title, "bold")}`);
}

export function ok(message: string): void {
	console.log(`  ${color("✓", "green")} ${message}`);
}

export function fail(message: string): void {
	console.log(`  ${color("✗", "red")} ${message}`);
}

export function info(message: string): void {
	console.log(`  ${color("→", "cyan")} ${message}`);
}
