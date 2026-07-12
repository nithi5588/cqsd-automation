import { tokenStore } from "../infrastructure/integrations";

export const ConnectionsService = {
	async getStatus() {
		const [constantContact, microsoft] = await Promise.all([
			tokenStore.status("CONSTANT_CONTACT"),
			tokenStore.status("MICROSOFT"),
		]);
		return { constantContact, microsoft };
	},
};
