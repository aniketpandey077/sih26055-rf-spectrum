import "./globals.css";

export const metadata = {
  title: "SIH26055 - Adaptive RF Spectrum Scanning",
  description: "Phase 1 - Simulated RF spectrum scanning dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
