import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Type for the result of patch directory helper
// Contains the resolved data directory, patch file path, and patch version string
// This helps avoid hard-coding the patch version in multiple places
// and keeps the code maintainable as patches update
//
type PatchDirResult = { dataDir: string; patchFile: string; version: string };

/**
 * Reads the current patch version from public/patch-data/patch.txt
 * and constructs the correct data directory and file path for champion data.
 * Throws if patch.txt is missing or unreadable.
 */
function getLatestPatchDir(): PatchDirResult {
  // Absolute path to the file that stores the latest patch version
  const patchTxtPath = path.resolve(process.cwd(), 'public/patch-data/patch.txt');
  let latestPatch = 'unknown';
  try {
    // Read and trim the patch version string
    latestPatch = fs.readFileSync(patchTxtPath, 'utf-8').trim();
  } catch (e) {
    // Log and throw if patch.txt is missing or unreadable
    console.error('Could not read patch.txt:', e);
    throw new Error('Patch version file not found.');
  }
  // Compose the directory and file path for the latest patch
  const dataDir = path.resolve(process.cwd(), `public/patch-data/${latestPatch}/data/en_US`);
  const patchFile = path.join(dataDir, 'champions.json');
  return { dataDir, patchFile, version: latestPatch };
}

/**
 * POST handler for refetching champion data.
 * Returns a JSON response indicating success and the patch version in use.
 * Handles errors for missing patch data or patch version file.
 */
export async function POST() {
  try {
    // Dynamically resolve the latest patch file location
    const { patchFile, version } = getLatestPatchDir();

    // Ensure the patch data file exists before attempting to read
    if (!fs.existsSync(patchFile)) {
      throw new Error('Patch data file not found');
    }

    // Read and parse the champion data JSON
    const rawData = JSON.parse(fs.readFileSync(patchFile, 'utf-8'));

    // Respond with success, message, and patch version
    return NextResponse.json({
      success: true,
      message: 'Champion data is already up to date',
      version: version
    });
  } catch (error) {
    // Log and respond with error details for debugging
    console.error('Error refetching champion data:', error);
    return NextResponse.json(
      { error: 'Failed to refetch champion data' },
      { status: 500 }
    );
  }
}