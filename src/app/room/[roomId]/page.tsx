import Game from '@/components/Game';
export default async function Room({ params }: { params: Promise<{ roomId: string }> }) { const { roomId } = await params; return <Game roomCode={roomId.toUpperCase()} />; }
