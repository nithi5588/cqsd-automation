"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useMounted } from "@/hooks/useMounted";
import { Button } from "./ui/button";

export function ThemeToggle() {
	const { resolvedTheme, setTheme } = useTheme();
	const mounted = useMounted();
	const dark = resolvedTheme !== "light";
	return (
		<Button
			variant="glass"
			size="icon"
			aria-label="Toggle theme"
			onClick={() => setTheme(dark ? "light" : "dark")}
			title={mounted ? (dark ? "Switch to light" : "Switch to dark") : "Toggle theme"}
		>
			{mounted ? dark ? <Sun size={17} /> : <Moon size={17} /> : <Sun size={17} />}
		</Button>
	);
}
