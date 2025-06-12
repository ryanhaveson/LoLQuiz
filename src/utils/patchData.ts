// Utility functions for patch data versioning and URL construction

/**
 * Fetches the current patch version from the server.
 * Returns the patch version as a string (e.g., '15.12.1').
 */
export async function fetchPatchVersion(): Promise<string> {
  const res = await fetch('/patch-data/patch.txt');
  return (await res.text()).trim();
}

/**
 * Constructs a URL for a given file in the current patch data directory.
 * @param patch - Patch version string
 * @param subPath - Path to the file within the patch data directory
 */
export function getPatchDataUrl(patch: string, subPath: string): string {
  return `/patch-data/${patch}/${subPath}`;
}
