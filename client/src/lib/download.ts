/**
 * Saves a fetched file to disk via a temporary object URL. The URL is revoked on
 * the next tick — revoking synchronously can cancel the download in some browsers.
 */
export function saveDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Reads the filename the server sent, falling back to the supplied default. */
export function filenameFromDisposition(
  disposition: string | null,
  fallback: string,
): string {
  if (!disposition) return fallback;
  const quoted = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  if (!quoted?.[1]) return fallback;
  try {
    return decodeURIComponent(quoted[1]);
  } catch {
    return quoted[1];
  }
}
