/**
 * Full-screen loading state for the recipient page.
 * Large readable text — never a blank white screen.
 */
export default function LoadingState({ message = 'Loading assistance…' }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-8">
      <div className="text-center animate-fade-in">
        <div
          className="w-14 h-14 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-8"
          role="status"
          aria-label="Loading"
        />
        <p className="text-[24px] text-slate-600 font-medium">{message}</p>
      </div>
    </div>
  );
}
