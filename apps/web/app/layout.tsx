import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PaymentWebhook Frontend',
  description: 'Next.js frontend for PaymentWebhook',
};

/**
 * ------------------------------------------------------
 * Root App Layout
 * ------------------------------------------------------
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
