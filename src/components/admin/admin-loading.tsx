import { LoaderCircle } from "lucide-react";

export function AdminLoading() {
  return (
    <div className="admin-loading-state flex items-center justify-center" role="status" aria-label="Loading page">
      <LoaderCircle className="admin-spinner" size={28} strokeWidth={1.7} aria-hidden="true" />
      <span className="admin-visually-hidden">Loading page</span>
    </div>
  );
}
