const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { exec } = require('child_process');
const { promisify } = require('util');
const { createWriteStream } = require('fs');

const execAsync = promisify(exec);
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const PATCH_DATA_DIR = path.join(process.cwd(), 'public', 'patch-data');

// Global variables to track download state
let downloadProgress = 0;
let isDownloading = false;
let downloadMessage = 'Checking patch data...';

async function downloadFile(url, dest) {
  console.log('Starting download from:', url);
  isDownloading = true;
  downloadMessage = 'Downloading patch data...';
  
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
        downloadMessage = `Downloading patch data... ${downloadProgress}%`;
        console.log(`Download progress: ${downloadProgress}%`);
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
      isDownloading = false;
      reject(err);
    });
  });
}

async function extractTgz(tgzPath, extractPath, patchVersion) {
  console.log('Extracting tgz file:', tgzPath);
  downloadMessage = 'Extracting patch data...';
  
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

async function checkAndDownloadPatchData() {
  console.log('Checking patch data on server startup...');
  try {
    // Check if patch data directory exists
    if (!fs.existsSync(PATCH_DATA_DIR)) {
      console.log('Patch data directory not found, creating...');
      fs.mkdirSync(PATCH_DATA_DIR, { recursive: true });
    }

    // Get latest patch version
    const versionsResponse = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    const versions = await versionsResponse.json();
    const latestPatch = versions[0];
    console.log('Latest patch version:', latestPatch);

    // Check if we need to download
    const patchFile = path.join(PATCH_DATA_DIR, 'patch.txt');
    let needsDownload = true;

    if (fs.existsSync(patchFile)) {
      const currentPatch = fs.readFileSync(patchFile, 'utf-8');
      if (currentPatch === latestPatch) {
        console.log('Patch data is up to date');
        needsDownload = false;
      }
    }

    if (needsDownload) {
      console.log('Downloading new patch data...');
      const archiveUrl = `https://ddragon.leagueoflegends.com/cdn/dragontail-${latestPatch}.tgz`;
      const archivePath = path.join(PATCH_DATA_DIR, 'archive.tgz');
      await downloadFile(archiveUrl, archivePath);
      await extractTgz(archivePath, PATCH_DATA_DIR, latestPatch);
      fs.writeFileSync(patchFile, latestPatch);
      console.log('Patch data download and extraction completed');
    }
  } catch (error) {
    console.error('Error checking/downloading patch data:', error);
  }
}

// Create a loading page HTML
const loadingPage = `
<!DOCTYPE html>
<html>
<head>
  <title>Loading - LoL Quiz</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background-color: #f9fafb;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 32rem;
    }
    .message {
      font-size: 1.125rem;
      color: #374151;
      margin-bottom: 1rem;
    }
    .progress-bar {
      width: 100%;
      height: 0.5rem;
      background-color: #e5e7eb;
      border-radius: 9999px;
      overflow: hidden;
    }
    .progress {
      height: 100%;
      background-color: #3b82f6;
      transition: width 0.3s ease;
    }
    .note {
      font-size: 0.875rem;
      color: #6b7280;
      margin-top: 0.5rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="message" id="message">Checking patch data...</div>
    <div class="progress-bar">
      <div class="progress" id="progress" style="width: 0%"></div>
    </div>
    <div class="note" id="note"></div>
  </div>
  <script>
    function updateProgress() {
      fetch('/api/progress')
        .then(res => res.json())
        .then(data => {
          document.getElementById('message').textContent = data.message;
          document.getElementById('progress').style.width = data.progress + '%';
          if (data.isDownloading) {
            document.getElementById('note').textContent = 'This may take a few minutes...';
          }
          if (data.progress < 100 || data.isDownloading) {
            setTimeout(updateProgress, 1000);
          } else {
            window.location.reload();
          }
        })
        .catch(error => {
          console.error('Error fetching progress:', error);
          setTimeout(updateProgress, 1000);
        });
    }
    updateProgress();
  </script>
</body>
</html>
`;

// Start the server immediately
app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    
    // Handle progress check endpoint
    if (parsedUrl.pathname === '/api/progress') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        progress: downloadProgress,
        isDownloading: isDownloading,
        message: downloadMessage
      }));
      return;
    }

    // Show loading page if still downloading
    if (isDownloading && parsedUrl.pathname === '/') {
      res.setHeader('Content-Type', 'text/html');
      res.end(loadingPage);
      return;
    }

    handle(req, res, parsedUrl);
  });

  // Try port 3000 first, fall back to 3001 if needed
  server.listen(3000, (err) => {
    if (err) {
      server.listen(3001, (err) => {
        if (err) throw err;
        console.log('> Ready on http://localhost:3001');
        // Start download check after server is ready
        checkAndDownloadPatchData();
      });
    } else {
      console.log('> Ready on http://localhost:3000');
      // Start download check after server is ready
      checkAndDownloadPatchData();
    }
  });
}); 