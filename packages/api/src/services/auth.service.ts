import { apiEnv } from "@cqsd/config";
import { prisma } from "@cqsd/db";
import { signAccessJwt } from "@cqsd/shared/auth";
import { UnauthorizedError } from "@cqsd/shared/http";
import { verifyPassword } from "@cqsd/shared/security";
import type { LoginInput } from "../validators/auth.validator";

export const AuthService = {
	async login(input: LoginInput) {
		const user = await prisma.user.findUnique({ where: { email: input.email } });
		if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
			throw new UnauthorizedError("Invalid email or password");
		}

		const token = await signAccessJwt({
			userId: user.id,
			email: user.email,
			role: user.role,
			secret: apiEnv.JWT_SECRET,
			issuer: apiEnv.JWT_ISSUER,
			audience: apiEnv.JWT_AUDIENCE,
		});

		return { token, user: { id: user.id, email: user.email, role: user.role } };
	},

	async me(userId: string) {
		const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
		return { id: user.id, email: user.email, role: user.role };
	},
};
