import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { GlassBackground } from "@/components/GlassBackground";
import { Providers } from "@/components/providers";

const inter = Inter({
	variable: "--font-inter",
	subsets: ["latin"],
	display: "swap",
});

export const metadata: Metadata = {
	title: "CompQsoft Digital · Marketing Automation",
	description:
		"CompQsoft Digital's marketing console — contacts, segments, email campaigns, Teams webinars and account plans in one place.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" suppressHydrationWarning className={`${inter.variable} h-full`}>
			<body className="min-h-full antialiased" suppressHydrationWarning>
				<Providers>
					<GlassBackground />
					{children}
				</Providers>
			</body>
		</html>
	);
}
