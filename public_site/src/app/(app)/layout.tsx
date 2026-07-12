import { AppShell } from "@/components/shell/AppShell";
import { RoleGuard } from "@/components/shell/RoleGuard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
	return (
		<RoleGuard>
			<AppShell>{children}</AppShell>
		</RoleGuard>
	);
}
