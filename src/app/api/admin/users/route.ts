import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: List all users (admin only)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, isAdmin: true }
  });
  return NextResponse.json(users);
}

// PATCH: Update isAdmin status for a user (admin only)
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id, isAdmin } = await req.json();
  if (typeof id !== 'string' || typeof isAdmin !== 'boolean') {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const user = await prisma.user.update({
    where: { id },
    data: { isAdmin },
    select: { id: true, name: true, email: true, isAdmin: true }
  });
  return NextResponse.json(user);
} 