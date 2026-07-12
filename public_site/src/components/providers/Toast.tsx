"use client";
import { CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";
import { cn } from "@/lib/cn";

type ToastTone = "ok" | "info" | "warn";

interface Toast {
	id: number;
	msg: string;
	tone: ToastTone;
}

const Ctx = createContext<{ toast: (msg: string, tone?: ToastTone) => void } | null>(null);

let seq = 0;
const icons = { ok: CircleCheck, info: Info, warn: TriangleAlert };
const toneColor = { ok: "text-[var(--ok)]", info: "text-[var(--info)]", warn: "text-[var(--warn)]" };

export function ToastProvider({ children }: { children: React.ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);

	const toast = useCallback((msg: string, tone: ToastTone = "ok") => {
		const id = ++seq;
		setToasts((t) => [...t, { id, msg, tone }]);
		setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
	}, []);

	return (
		<Ctx.Provider value={{ toast }}>
			{children}
			<div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
				{toasts.map((t) => {
					const Icon = icons[t.tone];
					return (
						<div
							key={t.id}
							className="animate-rise pointer-events-auto flex items-start gap-2.5 rounded-xl glass-strong p-3 text-sm shadow-lg"
						>
							<Icon size={17} className={cn("mt-0.5 shrink-0", toneColor[t.tone])} />
							<span className="flex-1 text-fg">{t.msg}</span>
							<button
								type="button"
								onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
								className="text-faint hover:text-fg"
								aria-label="Dismiss"
							>
								<X size={15} />
							</button>
						</div>
					);
				})}
			</div>
		</Ctx.Provider>
	);
}

export function useToast() {
	const ctx = useContext(Ctx);
	if (!ctx) throw new Error("useToast must be used within ToastProvider");
	return ctx.toast;
}
