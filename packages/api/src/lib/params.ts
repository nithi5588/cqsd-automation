import { BadRequestError } from "@cqsd/shared/http";
import type { Context } from "hono";

/**
 * Reads a path parameter that the route definition guarantees is present.
 * Hono types `ctx.req.param()` as possibly undefined when the controller is
 * defined apart from its route, so this narrows it once instead of at every
 * call site.
 */
export function requiredParam(ctx: Context, name: string): string {
	const value = ctx.req.param(name);
	if (!value) throw new BadRequestError(`Missing "${name}" path parameter`);
	return value;
}
