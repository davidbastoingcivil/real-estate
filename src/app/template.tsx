// Re-mounted on every navigation: gives each route an app-like entrance animation.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-transition">{children}</div>;
}
