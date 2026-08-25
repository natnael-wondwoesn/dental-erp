import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'Natnael Product Operations' },
  robots: { index: false, follow: false },
}

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return children
}
