import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { createWriteStream } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const CHAMPION_DATA_DIR = path.join(process.cwd(), 'public', 'champion-data');

// Ensure the champion data directory exists
if (!fs.existsSync(CHAMPION_DATA_DIR)) {
  console.log('Creating champion data directory:', CHAMPION_DATA_DIR);
  fs.mkdirSync(CHAMPION_DATA_DIR, { recursive: true });
}

async function downloadFile(url: string, dest: string): Promise<void> {
  console.log('Downloading file from:', url);
  console.log('Saving to:', dest);
  
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
    console.error('Response headers:', response.headers);
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }

  const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
  console.log(`Total file size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

  const file = createWriteStream(dest);
  let downloadedBytes = 0;

  return new Promise((resolve, reject) => {
    response.body.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      const progress = (downloadedBytes / totalBytes) * 100;
      console.log(`Download progress: ${progress.toFixed(2)}% (${(downloadedBytes / 1024 / 1024).toFixed(2)} MB / ${(totalBytes / 1024 / 1024).toFixed(2)} MB)`);
    });

    response.body.on('end', () => {
      console.log('Download completed');
      file.end();
    });

    response.body.on('error', (err) => {
      console.error('Download error:', err);
      file.end();
      reject(err);
    });

    file.on('finish', () => {
      console.log('File write completed');
      resolve();
    });

    file.on('error', (err) => {
      console.error('File write error:', err);
      reject(err);
    });

    response.body.pipe(file);
  });
}

async function extractTgz(tgzPath: string, extractPath: string, patchVersion: string): Promise<void> {
  console.log('Extracting tgz file:', tgzPath);
  console.log('Extracting to:', extractPath);
  
  try {
    // Use tar command to extract the .tgz file
    const { stdout, stderr } = await execAsync(`tar -xzf "${tgzPath}" -C "${extractPath}"`);
    if (stderr) {
      console.error('Extraction stderr:', stderr);
    }
    console.log('Extraction completed');
    
    // Verify extraction using the correct patch version
    const expectedPath = path.join(extractPath, patchVersion, 'data', 'en_US', 'champion.json');
    if (fs.existsSync(expectedPath)) {
      console.log('Extraction verified - champion.json exists');
    } else {
      console.error('Extraction failed - champion.json not found at:', expectedPath);
      throw new Error('Failed to extract champion data');
    }
  } catch (error) {
    console.error('Error extracting file:', error);
    throw error;
  }
}

export async function GET() {
  try {
    // Get latest patch version
    console.log('Fetching latest patch version...');
    const response = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    const versions = await response.json();
    const latestPatch = versions[0];
    console.log('Latest patch version:', latestPatch);

    // Check if we already have this patch
    const patchFile = path.join(CHAMPION_DATA_DIR, 'patch.txt');
    let currentPatch = '';
    if (fs.existsSync(patchFile)) {
      currentPatch = fs.readFileSync(patchFile, 'utf-8');
      console.log('Current patch version:', currentPatch);
    }

    if (currentPatch === latestPatch) {
      console.log('Already on latest patch');
      return NextResponse.json({ 
        message: 'Already on latest patch',
        patch: latestPatch 
      });
    }

    // Download the archive using the correct CDN URL format
    const archiveUrl = `https://ddragon.leagueoflegends.com/cdn/dragontail-${latestPatch}.tgz`;
    const archivePath = path.join(CHAMPION_DATA_DIR, 'archive.tgz');
    
    // Check if the .tgz file already exists
    if (fs.existsSync(archivePath)) {
      console.log('Archive file already exists, skipping download.');
    } else {
      console.log('Starting download of champion data...');
      await downloadFile(archiveUrl, archivePath);
      console.log('Download completed, starting extraction...');
    }
    
    // Extract the archive
    await extractTgz(archivePath, CHAMPION_DATA_DIR, latestPatch);
    console.log('Extraction completed');
    
    // Save the patch version
    fs.writeFileSync(patchFile, latestPatch);
    console.log('Saved new patch version:', latestPatch);

    return NextResponse.json({ 
      message: 'Successfully downloaded and extracted champion data',
      patch: latestPatch 
    });
  } catch (error) {
    console.error('Error downloading champion data:', error);
    return NextResponse.json(
      { error: 'Failed to download champion data' },
      { status: 500 }
    );
  }
} 