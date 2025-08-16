import { NextResponse } from 'next/server';

// Mock data - in a real application, this would come from a database
const players = [
  { id: 1, name: "John Doe", age: 20, position: "Forward" },
  { id: 2, name: "Jane Smith", age: 22, position: "Midfielder" },
];

export async function GET() {
  return NextResponse.json(players);
}

export async function POST(req: Request) {
  const newplayer = await req.json();
  players.push({ ...newplayer, id: players.length + 1 });
  return NextResponse.json(newplayer, { status: 201 });
}

