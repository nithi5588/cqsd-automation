import { cn } from "@/lib/cn";

const fieldBase =
	"w-full rounded-lg border border-hairline bg-[var(--glass-strong)] px-3 text-[13px] text-fg placeholder:text-faint " +
	"outline-none transition-colors focus:border-hairline-strong focus:ring-2 " +
	"focus:ring-[color-mix(in_srgb,var(--accent)_45%,transparent)]";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
	return <input className={cn(fieldBase, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
	return <textarea className={cn(fieldBase, "min-h-24 py-2", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
	return (
		<select className={cn(fieldBase, "h-9 appearance-none pr-8", className)} {...props}>
			{children}
		</select>
	);
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
	return <label className={cn("mb-1.5 block text-xs font-medium text-muted", className)} {...props} />;
}
