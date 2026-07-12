import {
	Building2,
	Funnel,
	Import,
	LayoutDashboard,
	Mail,
	Plug,
	Shield,
	Users,
	Video,
} from "lucide-react";
import type { UserRole } from "@/types";

export interface NavItem {
	href: string;
	label: string;
	icon: React.ReactNode;
	/** Visible to every role unless restricted. */
	roles?: UserRole[];
}

export interface NavGroup {
	title: string;
	items: NavItem[];
}

const s = 17;

export const NAV: NavGroup[] = [
	{
		title: "Marketing",
		items: [
			{ href: "/", label: "Overview", icon: <LayoutDashboard size={s} /> },
			{ href: "/contacts", label: "Contacts", icon: <Users size={s} /> },
			{ href: "/segments", label: "Segments", icon: <Funnel size={s} /> },
			{ href: "/campaigns", label: "Campaigns", icon: <Mail size={s} /> },
			{ href: "/webinars", label: "Webinars", icon: <Video size={s} /> },
		],
	},
	{
		title: "Accounts",
		items: [
			{ href: "/account-plans", label: "Account Plans", icon: <Building2 size={s} /> },
			{ href: "/leads", label: "Leads", icon: <Import size={s} /> },
		],
	},
	{
		title: "System",
		items: [
			{ href: "/connections", label: "Connections", icon: <Plug size={s} /> },
			{ href: "/admin", label: "Admin", icon: <Shield size={s} />, roles: ["ADMIN"] },
		],
	},
];

/** True when a nav item should be shown to the given role. */
export function navVisible(item: NavItem, role: UserRole): boolean {
	return !item.roles || item.roles.includes(role);
}
