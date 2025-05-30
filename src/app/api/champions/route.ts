import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Helper to get the path to the data directory and files
const dataDir = path.resolve(process.cwd(), 'public/champion-data/15.11.1/data/en_US');
const championsFile = path.join(dataDir, 'championFull.json');

export async function GET() {
  try {
    // Read the champion data from local file
    if (!fs.existsSync(championsFile)) {
      throw new Error('Champion data file not found');
    }

    const rawData = JSON.parse(fs.readFileSync(championsFile, 'utf-8'));
    console.log('Raw data structure:', {
      hasData: !!rawData.data,
      dataKeys: rawData.data ? Object.keys(rawData.data) : [],
      type: rawData.type,
      version: rawData.version
    });

    if (!rawData.data) {
      throw new Error('Invalid champion data structure');
    }

    // Return data in the structure that the client expects
    const response = {
      data: {
        data: rawData.data
      },
      type: rawData.type,
      version: rawData.version,
      local: true
    };

    console.log('Sending response with structure:', {
      hasData: !!response.data,
      hasDataData: !!response.data.data,
      dataDataKeys: response.data.data ? Object.keys(response.data.data) : []
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching champion data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch champion data' },
      { status: 500 }
    );
  }
} 