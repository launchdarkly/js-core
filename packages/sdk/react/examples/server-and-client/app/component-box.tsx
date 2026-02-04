/**
 * SHARED: Safe to import from both Server and Client Components.
 * A pure rendering wrapper that visually labels each component's render environment.
 */
import type { ReactNode } from 'react';

export type RenderEnv = 'server' | 'client';

const BADGE: Record<RenderEnv, string> = {
  server: '⚙ SERVER COMPONENT',
  client: '⚡ CLIENT COMPONENT',
};

export default function ComponentBox({
  env,
  filename,
  description,
  children,
}: {
  env: RenderEnv;
  filename: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`box ${env}`}>
      <div className={`box-header ${env}`}>
        <span className="box-badge">{BADGE[env]}</span>
        <code className="box-filename">{filename}</code>
      </div>
      {description && <div className="box-description">{description}</div>}
      <div className={`box-body ${env}`}>{children}</div>
    </div>
  );
}
