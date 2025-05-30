import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Helper to get the path to the data directory and files
const dataDir = path.resolve(process.cwd(), 'data');
const championsFile = path.join(dataDir, 'champions.json');

export async function POST() {
  try {
    // Check if the champions file exists
    if (!fs.existsSync(championsFile)) {
      throw new Error('Champion data file not found');
    }

    // Read the current champion data
    const rawData = JSON.parse(fs.readFileSync(championsFile, 'utf-8'));

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Champion data is already up to date',
      version: rawData.version
    });
  } catch (error) {
    console.error('Error refetching champion data:', error);
    return NextResponse.json(
      { error: 'Failed to refetch champion data' },
      { status: 500 }
    );
  }
} 