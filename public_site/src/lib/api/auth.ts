import type { LoginResult, User } from "@/types";
import { apiRequest } from "./client";

export const authApi = {
	login(email: string, password: string): Promise<LoginResult> {
		return apiRequest<LoginResult>("/auth/login", { method: "POST", body: { email, password } });
	},

	me(token: string): Promise<{ user: User }> {
		return apiRequest<{ user: User }>("/auth/me", { token });
	},
};
