"use client";
import { ArrowRight, Building2, Mail, Users, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { Spinner } from "@/components/ui/misc";

export default function LoginPage() {
	const { login } = useAuth();
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);
		try {
			await login(email, password);
			const next = new URLSearchParams(window.location.search).get("next");
			router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Login failed");
			setLoading(false);
		}
	}

	return (
		<div className="grid min-h-screen place-items-center bg-bg p-4">
			<div className="absolute right-4 top-4">
				<ThemeToggle />
			</div>

			<div className="grid w-full max-w-[980px] overflow-hidden rounded-[var(--radius-lg)] border border-hairline bg-[var(--glass-strong)] shadow-[var(--shadow-overlay)] md:grid-cols-2">
				{/* brand / marketing */}
				<div className="brand-gradient-bg relative hidden flex-col justify-between overflow-hidden p-9 text-white md:flex">
					<div
						aria-hidden
						className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl"
					/>
					<div
						aria-hidden
						className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-black/10 blur-3xl"
					/>

					<div className="relative flex items-center gap-2.5">
						<span className="flex shrink-0 items-center rounded-lg bg-white px-2 py-1 shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
							<img src="/logo.png" alt="CompQsoft Digital" className="h-5 w-auto object-contain" />
						</span>
						<span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70">
							Marketing Automation
						</span>
					</div>
					<div className="relative">
						<h1 className="text-[28px] font-extrabold leading-[1.15] tracking-tight text-white">
							One console for the whole funnel.
						</h1>
						<p className="mt-3 text-[13.5px] leading-relaxed text-white/80">
							Import contacts, build segments, run Constant Contact campaigns and Teams webinars — then turn
							engagement into account plans.
						</p>
						<div className="mt-6 flex flex-wrap gap-2">
							{[
								{ icon: <Users size={14} />, label: "Contacts" },
								{ icon: <Mail size={14} />, label: "Campaigns" },
								{ icon: <Video size={14} />, label: "Webinars" },
								{ icon: <Building2 size={14} />, label: "Account Plans" },
							].map((c) => (
								<span
									key={c.label}
									className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm"
								>
									{c.icon} {c.label}
								</span>
							))}
						</div>
					</div>
					<p className="relative text-xs text-white/60">CompQsoft Digital · internal marketing console</p>
				</div>

				{/* form */}
				<div className="p-9">
					<h2 className="text-xl font-extrabold tracking-tight text-fg">Sign in</h2>
					<p className="mt-1 text-[13px] text-muted">Use your workspace credentials to continue.</p>

					<form onSubmit={submit} className="mt-6 space-y-4">
						<div>
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								type="email"
								autoComplete="username"
								placeholder="admin@cqsddigital.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
							/>
						</div>
						<div>
							<Label htmlFor="pw">Password</Label>
							<Input
								id="pw"
								type="password"
								autoComplete="current-password"
								placeholder="••••••••"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
							/>
						</div>
						{error && (
							<p className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-[13px] text-[var(--danger)]">
								{error}
							</p>
						)}
						<Button type="submit" variant="primary" size="md" className="w-full" disabled={loading}>
							{loading ? (
								<Spinner />
							) : (
								<>
									Sign in <ArrowRight size={16} />
								</>
							)}
						</Button>
					</form>
				</div>
			</div>
		</div>
	);
}
