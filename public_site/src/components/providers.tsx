"use client";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./providers/AuthProvider";
import { ToastProvider } from "./providers/Toast";

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
			<AuthProvider>
				<ToastProvider>{children}</ToastProvider>
			</AuthProvider>
		</ThemeProvider>
	);
}
