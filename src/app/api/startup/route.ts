import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createWriteStream } from 'fs';

const execAsync = promisify(exec);
const PATCH_DATA_DIR = path.join(process.cwd(), 'public', 'patch-data');

// Global variable to track download progress
let downloadProgress = 0;
let isDownloading = false;

async function downloadFile(url: string, dest: string): Promise<void> {
  console.log('Starting download from:', url);
  isDownloading = true;
  downloadProgress = 0;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'application/x-gzip,application/octet-stream',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://ddragon.leagueoflegends.com',
      'Referer': 'https://ddragon.leagueoflegends.com/',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    },
    redirect: 'follow'
  });

  if (!response.ok) {
    isDownloading = false;
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }

  const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
  console.log('Total file size:', totalBytes, 'bytes');
  let downloadedBytes = 0;

  const file = createWriteStream(dest);
  return new Promise((resolve, reject) => {
    response.body.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      const newProgress = Math.round((downloadedBytes / totalBytes) * 100);
      if (newProgress !== downloadProgress) {
        downloadProgress = newProgress;
        console.log('Download progress:', downloadProgress + '%');
      }
    });

    response.body.pipe(file);
    file.on('finish', () => {
      console.log('Download completed');
      downloadProgress = 100;
      isDownloading = false;
      resolve();
    });
    file.on('error', (err) => {
      console.error('File write error:', err);
      isDownloading = false;
      reject(err);
    });
  });
}

async function extractTgz(tgzPath: string, extractPath: string, patchVersion: string): Promise<void> {
  console.log('Extracting tgz file:', tgzPath);
  console.log('Extracting to:', extractPath);
  
  try {
    const { stdout, stderr } = await execAsync(`tar -xzf "${tgzPath}" -C "${extractPath}"`);
    if (stderr) {
      console.error('Extraction stderr:', stderr);
    }
    console.log('Extraction completed');
    
    const expectedPath = path.join(extractPath, patchVersion, 'data', 'en_US', 'champion.json');
    if (!fs.existsSync(expectedPath)) {
      throw new Error('Failed to extract patch data');
    }
  } catch (error) {
    console.error('Error extracting file:', error);
    throw error;
  }
}

async function downloadPatchData(): Promise<void> {
  console.log('Starting patch data download process');
  try {
    // Get latest patch version
    const versionsResponse = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    const versions = await versionsResponse.json();
    const latestPatch = versions[0];
    console.log('Latest patch version:', latestPatch);

    // Ensure directory exists
    if (!fs.existsSync(PATCH_DATA_DIR)) {
      console.log('Creating patch data directory');
      fs.mkdirSync(PATCH_DATA_DIR, { recursive: true });
    }

    // Download the archive
    const archiveUrl = `https://ddragon.leagueoflegends.com/cdn/dragontail-${latestPatch}.tgz`;
    const archivePath = path.join(PATCH_DATA_DIR, 'archive.tgz');
    console.log('Downloading archive from:', archiveUrl);
    await downloadFile(archiveUrl, archivePath);

    // Extract the archive
    console.log('Extracting archive...');
    await extractTgz(archivePath, PATCH_DATA_DIR, latestPatch);

    // Save the patch version
    fs.writeFileSync(path.join(PATCH_DATA_DIR, 'patch.txt'), latestPatch);
    console.log('Patch data download and extraction completed');
  } catch (error) {
    console.error('Error in downloadPatchData:', error);
    throw error;
  }
}

export async function GET() {
  console.log('Startup route called');
  try {
    // Check if patch data directory exists
    console.log('Checking if patch data directory exists:', PATCH_DATA_DIR);
    if (!fs.existsSync(PATCH_DATA_DIR)) {
      console.log('Patch data directory not found, starting download...');
      await downloadPatchData();
      return NextResponse.json({ 
        message: 'Patch data downloaded successfully',
        downloaded: true,
        progress: 100,
        isDownloading: false
      });
    }

    // Check if we have the latest patch
    const patchFile = path.join(PATCH_DATA_DIR, 'patch.txt');
    console.log('Checking patch version file:', patchFile);
    if (!fs.existsSync(patchFile)) {
      console.log('Patch version file not found, starting download...');
      await downloadPatchData();
      return NextResponse.json({ 
        message: 'Patch data downloaded successfully',
        downloaded: true,
        progress: 100,
        isDownloading: false
      });
    }

    // Read current patch version
    const currentPatch = fs.readFileSync(patchFile, 'utf-8');
    console.log('Current patch version:', currentPatch);
    
    // Get latest patch version from Data Dragon
    console.log('Fetching latest patch version from Data Dragon...');
    const versionsResponse = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    const versions = await versionsResponse.json();
    const latestPatch = versions[0];
    console.log('Latest patch version:', latestPatch);

    if (currentPatch !== latestPatch) {
      console.log('New patch available, starting download...');
      await downloadPatchData();
      return NextResponse.json({ 
        message: 'Patch data updated successfully',
        downloaded: true,
        progress: 100,
        isDownloading: false
      });
    }

    console.log('Patch data is up to date');
    return NextResponse.json({ 
      message: 'Patch data is up to date',
      downloaded: false,
      progress: 100,
      isDownloading: false
    });
  } catch (error) {
    console.error('Error during startup check:', error);
    return NextResponse.json(
      { error: 'Failed to check patch data' },
      { status: 500 }
    );
  }
}

// Add a new endpoint to get download progress
export async function POST() {
  console.log('Progress check - Current progress:', downloadProgress, '%, Is downloading:', isDownloading);
  return NextResponse.json({ 
    progress: downloadProgress,
    isDownloading: isDownloading
  });
} 