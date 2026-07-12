"use client";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	return (
		<div className="grid min-h-screen place-items-center p-6">
			<GlassCard className="max-w-md p-8 text-center">
				<h1 className="text-lg font-semibold">Something went wrong</h1>
				<p className="mt-1 text-sm text-muted">{error.message || "An unexpected error occurred."}</p>
				<Button variant="primary" className="mt-5" onClick={reset}>
					Try again
				</Button>
			</GlassCard>
		</div>
	);
}
