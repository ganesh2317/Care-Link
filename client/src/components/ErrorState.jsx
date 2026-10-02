/**
 * Full-screen error / not-found / inactive state for the recipient page.
 * Friendly message, never a raw 404 or stack trace.
 */
export default function ErrorState({
  emoji = '⚠️',
  title = 'Something went wrong',
  message = 'Please try again or contact your caregiver.',
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-8">
      <div className="text-center max-w-sm animate-fade-in">
        <span className="text-7xl block mb-6" role="img" aria-hidden="true">
          {emoji}
        </span>
        <h1 className="text-[36px] font-bold text-slate-900 mb-4 leading-tight">
          {title}
        </h1>
        <p className="text-[24px] text-slate-500 leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
