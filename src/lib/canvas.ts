import type { Operation, Point } from './types';
export function pointFor(canvas: HTMLCanvasElement, event: PointerEvent): Point { const r = canvas.getBoundingClientRect(); return [Math.max(0, Math.min(1, (event.clientX-r.left)/r.width)), Math.max(0, Math.min(1, (event.clientY-r.top)/r.height))]; }
export function drawOperation(ctx: CanvasRenderingContext2D, op: Operation, width: number, height: number) {
  if (op.type === 'clear') { ctx.fillStyle = '#fff'; ctx.fillRect(0,0,width,height); return; }
  if (op.type === 'fill') { ctx.fillStyle = op.color; ctx.fillRect(0,0,width,height); return; }
  if (op.type === 'undo') return;
  ctx.strokeStyle = op.eraser ? '#fff' : op.color; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = op.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const points = op.points; if (!points.length) return;
  if (points.length === 1) { ctx.beginPath(); ctx.arc(points[0][0]*width, points[0][1]*height, op.size/2, 0, Math.PI*2); ctx.fill(); return; }
  ctx.beginPath(); ctx.moveTo(points[0][0]*width, points[0][1]*height);
  for (const p of points.slice(1)) ctx.lineTo(p[0]*width,p[1]*height);
  ctx.stroke();
}
export function renderOperations(ctx: CanvasRenderingContext2D, ops: Operation[], width: number, height: number) {
  const stack: Operation[] = []; for (const op of ops) { if (op.type === 'undo') { for (let i=stack.length-1;i>=0;i--) { if (stack[i].type === 'stroke') { stack.splice(i,1); break; } } } else if (op.type === 'clear' || op.type === 'fill') { stack.length = 0; stack.push(op); } else stack.push(op); }
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,width,height); for (const op of stack) drawOperation(ctx,op,width,height);
}
