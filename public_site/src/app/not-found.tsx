import Link from "next/link";
import { GlassCard } from "@/components/ui/glass";

export default function NotFound() {
	return (
		<div className="grid min-h-screen place-items-center p-6">
			<GlassCard className="max-w-md p-8 text-center">
				<p className="text-6xl font-bold tracking-tight text-emboss">404</p>
				<h1 className="mt-2 text-lg font-semibold">Page not found</h1>
				<p className="mt-1 text-sm text-muted">The page you’re looking for doesn’t exist or has moved.</p>
				<Link
					href="/"
					className="mt-5 inline-flex h-10 items-center rounded-xl bg-accent px-5 text-sm font-medium text-accent-fg text-emboss"
				>
					Back to dashboard
				</Link>
			</GlassCard>
		</div>
	);
}
