/**
 * Dashboard empty state — shown when the caregiver has no cards yet.
 */
export default function EmptyState({ onCreateClick }) {
  return (
    <div className="text-center py-20 px-6 animate-fade-in">
      <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <span className="text-4xl">📋</span>
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">
        No assistance cards yet
      </h2>
      <p className="text-lg text-slate-500 mb-8 max-w-md mx-auto leading-relaxed">
        Create your first QR assistance card to help your family navigate, call,
        or access important information with a single scan.
      </p>
      <button
        onClick={onCreateClick}
        className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-semibold text-lg
                   hover:bg-blue-700 transition-all duration-200 shadow-lg shadow-blue-600/20
                   active:scale-[0.98]"
      >
        + Create Your First Card
      </button>
    </div>
  );
}
