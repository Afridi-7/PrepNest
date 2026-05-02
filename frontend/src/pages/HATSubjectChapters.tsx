/**
 * HAT Subject Chapters page.
 *
 * Reuses the full USATSubjectChapters component but hard-codes
 * `category = "HAT"` (HAT has no category segment in the URL) and
 * points the "Back" link to /hat.
 */
import USATSubjectChapters from "./USATSubjectChapters";

export default function HATSubjectChapters() {
  return <USATSubjectChapters forcedCategory="HAT" backPath="/hat" />;
}
