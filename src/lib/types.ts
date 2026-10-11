export type Player = { id: string; name: string; avatar: string; score: number; connected: boolean; guessed: boolean };
export type Point = [number, number];
export type Operation = { type: 'stroke'; points: Point[]; color: string; size: number; eraser?: boolean; seq?: number } | { type: 'fill'; color: string; seq?: number } | { type: 'clear'; seq?: number } | { type: 'undo'; seq?: number };
export type Message = { id: string; type: 'system' | 'player'; playerId?: string; name?: string; text: string; at: number };
export type Replay = { drawer: string; word: string; ops: Operation[] };
export type RoomState = { code: string; version: number; phase: 'lobby' | 'selecting' | 'drawing' | 'intermission' | 'results'; hostId: string; players: Player[]; rounds: number; duration: number; round: number; turn: number; drawerId: string | null; deadline: number | null; maskedWord: string; ops: Operation[]; replay?: Replay[]; messages: Message[] };
export type Reply = { ok: true; code?: string; playerId?: string; token?: string; state?: RoomState; seq?: number } | { ok: false; error: string };
