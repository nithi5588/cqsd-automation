"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, authApi } from "@/lib/api";
import type { User } from "@/types";

const TOKEN_KEY = "cqsd_token";
const SESSION_COOKIE = "cqsd_session";

interface AuthCtx {
	user: User | null;
	token: string | null;
	loading: boolean;
	login: (email: string, password: string) => Promise<void>;
	logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

/**
 * The JWT lives in localStorage (read by the api client); the cookie is a
 * plain presence flag so the proxy can gate routes server-side without ever
 * seeing the token itself.
 */
function writeSessionCookie(present: boolean) {
	if (typeof document === "undefined") return;
	document.cookie = present
		? `${SESSION_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 7}`
		: `${SESSION_COOKIE}=; path=/; max-age=0`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	// Rehydrate: stored token → /auth/me. A 401 means the token is dead — drop it.
	useEffect(() => {
		let cancelled = false;
		const stored = localStorage.getItem(TOKEN_KEY);
		if (!stored) {
			setLoading(false);
			return;
		}
		setToken(stored);
		authApi
			.me(stored)
			.then(({ user: me }) => {
				if (cancelled) return;
				setUser(me);
				writeSessionCookie(true);
			})
			.catch((err) => {
				if (cancelled) return;
				if (err instanceof ApiError && err.status === 401) {
					localStorage.removeItem(TOKEN_KEY);
					writeSessionCookie(false);
					setToken(null);
				}
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const login = useCallback(async (email: string, password: string) => {
		const { token: nextToken, user: nextUser } = await authApi.login(email, password);
		localStorage.setItem(TOKEN_KEY, nextToken);
		writeSessionCookie(true);
		setToken(nextToken);
		setUser(nextUser);
	}, []);

	const logout = useCallback(() => {
		localStorage.removeItem(TOKEN_KEY);
		writeSessionCookie(false);
		setToken(null);
		setUser(null);
	}, []);

	const value = useMemo<AuthCtx>(
		() => ({ user, token, loading, login, logout }),
		[user, token, loading, login, logout],
	);

	return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
	const ctx = useContext(Ctx);
	if (!ctx) throw new Error("useAuth must be used within AuthProvider");
	return ctx;
}
