"use client";

import { useCallback, useEffect, useState } from "react";

export interface AsyncState<T> {
	data: T | undefined;
	loading: boolean;
	error: string | null;
	reload: () => void;
}

/** Wraps a promise-returning api call with loading/error/reload state for a page to render directly. */
export function useAsyncData<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
	const [data, setData] = useState<T>();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [tick, setTick] = useState(0);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError(null);

		fn()
			.then((result) => {
				if (!cancelled) setData(result);
			})
			.catch((err) => {
				if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong");
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [...deps, tick]);

	const reload = useCallback(() => setTick((t) => t + 1), []);

	return { data, loading, error, reload };
}
