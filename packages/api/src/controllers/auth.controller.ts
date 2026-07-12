import type { Context } from "hono";
import { AuthService } from "../services/auth.service";
import { loginSchema } from "../validators/auth.validator";

export const AuthController = {
	async login(ctx: Context) {
		const body = loginSchema.parse(await ctx.req.json());
		const result = await AuthService.login(body);
		return ctx.json(result);
	},

	async me(ctx: Context) {
		const authUser = ctx.get("authUser");
		const user = await AuthService.me(authUser.sub);
		return ctx.json({ user });
	},
};
