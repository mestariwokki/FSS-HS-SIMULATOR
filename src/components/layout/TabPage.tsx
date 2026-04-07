import type { ReactNode } from 'react';

interface TabPageProps {
  active: boolean;
  children: ReactNode;
}

export function TabPage({ active, children }: TabPageProps) {
  if (!active) return null;
  return <div>{children}</div>;
}
