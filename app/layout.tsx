import type { Metadata } from "next";
import "./globals.css";
import "./reel.css";

export const metadata: Metadata = {
  title: "Agentic AI Smart Classroom",
  description: "A voice-enabled AI teaching assistant that listens, understands the lesson and autonomously creates educational content.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
