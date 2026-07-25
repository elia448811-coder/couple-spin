import type { AppSettings, GameState } from '../types/game';

type ShareData = {
  eveningName: string;
  playerOneName: string;
  playerTwoName: string;
  playerOneColor: string;
  playerTwoColor: string;
  completed: number;
  skipped: number;
  winner: string | null;
  durationMinutes: number;
  phrase: string;
};

export function buildShareText(data: ShareData): string {
  const winnerLine = data.winner ? `מנצח/ת: ${data.winner}` : 'סיימנו בתיקו!';
  return [
    `🎡 ${data.eveningName || 'ספין זוגי'}`,
    `${data.phrase}`,
    `✅ ${data.completed} משימות | ⏭️ ${data.skipped} דילוגים`,
    winnerLine,
    `⏱️ ${data.durationMinutes} דקות`,
    '',
    'משחקנו עם ספין זוגי 💜',
  ].join('\n');
}

export async function generateShareImage(
  data: ShareData,
  settings: AppSettings,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const grad = ctx.createLinearGradient(0, 0, 600, 800);
  grad.addColorStop(0, '#10071f');
  grad.addColorStop(0.5, '#1b0d3d');
  grad.addColorStop(1, '#090414');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 600, 800);

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(ctx, 40, 60, 520, 680, 32);
  ctx.fill();

  ctx.font = 'bold 42px Heebo, Arial';
  ctx.fillStyle = '#facc15';
  ctx.textAlign = 'center';
  ctx.fillText('ספין זוגי', 300, 140);

  ctx.font = '24px Heebo, Arial';
  ctx.fillStyle = '#d6cff5';
  ctx.fillText(data.eveningName || 'ערב זוגי מושלם', 300, 190);

  ctx.font = 'bold 72px Heebo, Arial';
  ctx.fillStyle = settings.playerOneColor;
  ctx.fillText(String(data.completed), 180, 320);
  ctx.fillStyle = '#d6cff5';
  ctx.font = '20px Heebo, Arial';
  ctx.fillText('משימות', 180, 360);

  ctx.font = 'bold 72px Heebo, Arial';
  ctx.fillStyle = settings.playerTwoColor;
  ctx.fillText(String(data.skipped), 420, 320);
  ctx.fillStyle = '#d6cff5';
  ctx.font = '20px Heebo, Arial';
  ctx.fillText('דילוגים', 420, 360);

  ctx.font = '22px Heebo, Arial';
  ctx.fillStyle = '#ffffff';
  wrapText(ctx, data.phrase, 300, 440, 460, 32);

  if (data.winner) {
    ctx.font = 'bold 28px Heebo, Arial';
    ctx.fillStyle = '#ff4fa3';
    ctx.fillText(`🏆 ${data.winner}`, 300, 540);
  }

  ctx.font = '18px Heebo, Arial';
  ctx.fillStyle = '#a78bfa';
  ctx.fillText(`${data.playerOneName} & ${data.playerTwoName}`, 300, 600);
  ctx.fillText(`${data.durationMinutes} דקות משחק`, 300, 640);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word + ' ';
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, cy);
}

export async function shareGameResult(
  data: ShareData,
  settings: AppSettings,
): Promise<void> {
  const text = buildShareText(data);
  const blob = await generateShareImage(data, settings);

  if (blob && navigator.share && navigator.canShare?.({ files: [new File([blob], 'spin.png', { type: 'image/png' })] })) {
    const file = new File([blob], 'couple-spin.png', { type: 'image/png' });
    await navigator.share({ title: 'ספין זוגי', text, files: [file] });
    return;
  }

  if (navigator.share) {
    await navigator.share({ title: 'ספין זוגי', text });
    return;
  }

  const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank', 'noopener,noreferrer');
}

export function buildEndShareData(
  game: GameState,
  settings: AppSettings,
  winnerName: string | null,
  phrase: string,
): ShareData {
  const durationMinutes = Math.max(
    1,
    Math.round((Date.now() - game.stats.startTime) / 60000),
  );
  return {
    eveningName: game.eveningName,
    playerOneName: game.playerOneName,
    playerTwoName: game.playerTwoName,
    playerOneColor: settings.playerOneColor,
    playerTwoColor: settings.playerTwoColor,
    completed: game.stats.totalCompleted,
    skipped: game.stats.totalSkipped,
    winner: winnerName,
    durationMinutes,
    phrase,
  };
}
