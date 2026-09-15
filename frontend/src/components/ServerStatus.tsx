import { useSyncExternalStore } from "react";
import { hasSlowRequest, subscribeToSlowRequests } from "../services/api";

export default function ServerStatus() {
  const waiting = useSyncExternalStore(subscribeToSlowRequests, hasSlowRequest, () => false);
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {waiting && (
        <div className="server-status-notice">
          <strong>Taking a little longer…</strong>
          <span>The server may be waking up. Please keep this page open while it responds.</span>
        </div>
      )}
    </div>
  );
}
