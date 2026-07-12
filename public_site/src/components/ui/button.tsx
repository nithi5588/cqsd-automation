import { cn } from "@/lib/cn";

type Variant = "primary" | "glass" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const base =
	"inline-flex items-center justify-center gap-2 rounded-lg font-medium select-none " +
	"transition-colors disabled:opacity-50 disabled:pointer-events-none " +
	"focus-visible:outline-2 whitespace-nowrap";

const variants: Record<Variant, string> = {
	primary: "bg-accent text-accent-fg hover:bg-[color-mix(in_srgb,var(--accent)_88%,#000)]",
	/* "glass" is the secondary button: flat white card with a border. */
	glass:
		"border border-hairline bg-[var(--glass-strong)] text-fg shadow-[0_1px_2px_rgba(16,24,40,0.05)] " +
		"hover:bg-fg/[0.04]",
	ghost: "text-fg hover:bg-[var(--accent-soft)]",
	danger: "bg-[var(--danger)] text-white hover:bg-[color-mix(in_srgb,var(--danger)_88%,#000)]",
};

const sizes: Record<Size, string> = {
	sm: "h-8 px-3 text-xs",
	md: "h-9 px-3.5 text-[13px]",
	lg: "h-10 px-5 text-sm",
	icon: "h-8 w-8 p-0",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: Variant;
	size?: Size;
}

export function Button({ className, variant = "glass", size = "md", ...props }: ButtonProps) {
	return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
