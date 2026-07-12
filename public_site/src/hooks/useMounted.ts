"use client";

import { useEffect, useState } from "react";

/** true after first client paint — used to defer client-only widgets (charts). */
export function useMounted(): boolean {
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	return mounted;
}
