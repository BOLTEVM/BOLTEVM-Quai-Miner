import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'BoltEVM Quai Miner',
    description: 'Premium Quai Network Mining Interface',
    icons: {
        icon: '/0logov3.png',
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
            </head>
            <body>
                <div className="layout-container">
                    {children}
                </div>
            </body>
        </html>
    )
}
