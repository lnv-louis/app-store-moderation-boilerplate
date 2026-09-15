import { ReviewQueue } from "@/components/ReviewQueue";
import { getAllApps } from "@/lib/fanvue/api";
import { countBySeverity } from "@/lib/moderation/queue";
import { reviewListings } from "@/lib/moderation/rules";

export const dynamic = "force-dynamic";

export default function ReviewQueuePage() {
  const started = performance.now();
  const rows = reviewListings(getAllApps());
  const durationMs = Math.round(performance.now() - started);
  const counts = countBySeverity(rows);
  console.info("[moderation] reviewed", {
    listings: rows.length,
    ...counts,
    durationMs,
    at: new Date().toISOString(),
  });

  return <ReviewQueue rows={rows} checkedAt={new Date().toISOString()} durationMs={durationMs} />;
}
