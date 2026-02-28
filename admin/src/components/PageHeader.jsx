export default function PageHeader({ title, description, children }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold text-nox-text">{title}</h1>
        {description && (
          <p className="text-sm text-nox-text-muted mt-1">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
