/* CanvasSlide: deterministic, local-only 16:9 typography for the stage screen. */
const WIDTH = 1600;
const HEIGHT = 900;

const PALETTES = {
  overture: { bg: '#160d20', bg2: '#04050c', text: '#fff6e6', muted: '#d0bfd0', accent: '#f2cf88', wash: 'rgba(166,85,108,.18)' },
  night: { bg: '#111426', bg2: '#070811', text: '#fff7e8', muted: '#c5c2d3', accent: '#eacb8c', wash: 'rgba(98,99,176,.17)' },
  burgundy: { bg: '#421327', bg2: '#140912', text: '#fff4e5', muted: '#e0c4c9', accent: '#f1cc89', wash: 'rgba(207,90,103,.19)' },
  ivory: { bg: '#f4ead8', bg2: '#d8c4a6', text: '#281a28', muted: '#584b53', accent: '#8d552f', wash: 'rgba(125,70,74,.10)' },
  gold: { bg: '#3c2817', bg2: '#100b0b', text: '#fff5dc', muted: '#dfcbb0', accent: '#ffdc8d', wash: 'rgba(240,183,86,.14)' },
  sage: { bg: '#19302a', bg2: '#07110f', text: '#f8f5df', muted: '#c5d2c3', accent: '#d2d9a6', wash: 'rgba(125,160,133,.15)' },
  blueprint: { bg: '#14283a', bg2: '#070e19', text: '#eef7f2', muted: '#bdd0d5', accent: '#b6dfeb', wash: 'rgba(89,160,181,.14)' },
  invitation: { bg: '#57132b', bg2: '#190814', text: '#fff5e7', muted: '#e8c7ce', accent: '#ffdb95', wash: 'rgba(235,126,116,.17)' },
  locked: { bg: '#1b1921', bg2: '#08080c', text: '#eee9ee', muted: '#b5acb9', accent: '#c3b5c8', wash: 'rgba(150,132,166,.10)' }
};

function spaced(ctx, text, x, y, gap = 3) {
  let cursor = x;
  for (const char of text) {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + gap;
  }
  return cursor - x - gap;
}

function linesFor(ctx, text, maxWidth, maxLines = 4) {
  const paragraphs = String(text || '').split('\n');
  const lines = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  if (lines.length > maxLines) {
    const trimmed = lines.slice(0, maxLines);
    let last = trimmed[maxLines - 1];
    while (last.length > 2 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    trimmed[maxLines - 1] = `${last.trim()}…`;
    return trimmed;
  }
  return lines;
}

function textBlock(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
  const lines = linesFor(ctx, text, maxWidth, maxLines);
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function coverImage(ctx, image, x, y, w, h) {
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = w / h;
  let sx = 0, sy = 0, sw = image.naturalWidth, sh = image.naturalHeight;
  if (sourceRatio > targetRatio) {
    sw = image.naturalHeight * targetRatio;
    sx = (image.naturalWidth - sw) / 2;
  } else {
    sh = image.naturalWidth / targetRatio;
    sy = (image.naturalHeight - sh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function ornamentalBackground(ctx, palette, isLight, locked) {
  const gradient = ctx.createRadialGradient(820, 360, 20, 790, 430, 1080);
  gradient.addColorStop(0, palette.bg);
  gradient.addColorStop(1, palette.bg2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = palette.wash;
  ctx.beginPath();
  ctx.ellipse(1330, 150, 520, 400, -0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = isLight ? 0.10 : 0.085;
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-80, 610 + i * 42);
    ctx.bezierCurveTo(450, 490 + i * 35, 1150, 790 + i * 18, 1720, 510 + i * 40);
    ctx.stroke();
  }
  ctx.globalAlpha = isLight ? 0.18 : 0.15;
  for (let r = 220; r <= 500; r += 70) {
    ctx.beginPath();
    ctx.arc(1510, 710, r, Math.PI, Math.PI * 1.72);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = palette.accent;
  ctx.globalAlpha = 0.58;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(32.5, 32.5, 1535, 835);
  ctx.globalAlpha = 0.24;
  ctx.strokeRect(43.5, 43.5, 1513, 813);
  ctx.globalAlpha = 1;

  [[70, 70, 1, 1], [1530, 70, -1, 1], [70, 830, 1, -1], [1530, 830, -1, -1]].forEach(([x, y, dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(x, y + dy * 26);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * 26, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + dx * 8, y + dy * 8, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = palette.accent;
    ctx.fill();
  });

  if (locked) {
    ctx.save();
    ctx.translate(1390, 135);
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, -12, 28, Math.PI, 0);
    ctx.stroke();
    ctx.strokeRect(-40, -12, 80, 66);
    ctx.beginPath();
    ctx.arc(0, 18, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/** Render a slide to a 1600×900 canvas. No network calls or external fonts. */
export function createSlideCanvas(slide, index, total, image = null) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  const palette = PALETTES[slide.theme] || PALETTES.night;
  const isLight = slide.theme === 'ivory';
  ornamentalBackground(ctx, palette, isLight, slide.theme === 'locked');

  const left = 94;
  const textWidth = image ? 925 : 1375;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = palette.accent;
  ctx.font = '600 19px Arial, sans-serif';
  spaced(ctx, 'OSO  /  DAO MEET', left, 78, 3.2);
  ctx.textAlign = 'right';
  ctx.font = '500 17px Arial, sans-serif';
  const movement = `MOVEMENT ${String(index + 1).padStart(2, '0')}  /  ${String(total).padStart(2, '0')}`;
  ctx.fillText(movement, 1506, 78);
  ctx.textAlign = 'left';
  ctx.globalAlpha = 0.38;
  ctx.fillRect(left, 99, 1412, 1);
  ctx.globalAlpha = 1;

  ctx.font = '600 22px Arial, sans-serif';
  ctx.fillStyle = palette.accent;
  spaced(ctx, slide.kicker.toUpperCase(), left, 149, 2.1);

  let titleSize = slide.id === 'overture' ? 116 : 82;
  if (image) titleSize = 70;
  if (slide.id === 'love') titleSize = 94;
  let titleLines;
  do {
    ctx.font = `500 ${titleSize}px Georgia, 'Times New Roman', serif`;
    titleLines = linesFor(ctx, slide.title, textWidth, 3);
    if (titleLines.length >= 3 && ctx.measureText(titleLines[2]).width > textWidth * 0.94) titleSize -= 2;
    else break;
  } while (titleSize > 54);
  const titleLineHeight = titleSize * 1.07;
  const titleY = image ? 254 : 270;
  ctx.fillStyle = palette.text;
  titleLines.forEach((line, i) => ctx.fillText(line, left, titleY + i * titleLineHeight));
  let cursorY = titleY + titleLines.length * titleLineHeight + 28;

  ctx.font = `italic 400 ${image ? 29 : 34}px Georgia, 'Times New Roman', serif`;
  ctx.fillStyle = palette.muted;
  cursorY = textBlock(ctx, slide.lede, left, cursorY, textWidth, image ? 39 : 46, 3) + 26;

  const bullets = slide.bullets || [];
  const bulletFont = image ? 24 : 28;
  const bulletLineHeight = image ? 33 : 38;
  ctx.font = `400 ${bulletFont}px Arial, sans-serif`;
  bullets.forEach((bullet, bulletIndex) => {
    // The footer is sacred: reduce type slightly on unusually dense editorial drafts.
    if (cursorY > 738) return;
    const bulletLines = linesFor(ctx, bullet, textWidth - 48, 3);
    ctx.fillStyle = palette.accent;
    ctx.save();
    ctx.translate(left + 7, cursorY - 8);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
    ctx.fillStyle = palette.text;
    ctx.globalAlpha = 0.92;
    bulletLines.forEach((line, lineIndex) => ctx.fillText(line, left + 34, cursorY + lineIndex * bulletLineHeight));
    ctx.globalAlpha = 1;
    cursorY += bulletLines.length * bulletLineHeight + (bulletIndex === bullets.length - 1 ? 0 : 19);
  });

  if (image) {
    const x = 1112, y = 224, w = 388, h = 465;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = 30;
    ctx.fillStyle = palette.bg2;
    ctx.fillRect(x - 8, y - 8, w + 16, h + 16);
    ctx.restore();
    coverImage(ctx, image, x, y, w, h);
    const shade = ctx.createLinearGradient(0, y + h * 0.6, 0, y + h);
    shade.addColorStop(0, 'rgba(5,4,10,0)');
    shade.addColorStop(1, 'rgba(5,4,10,.42)');
    ctx.fillStyle = shade;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = palette.accent;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 8, y - 8, w + 16, h + 16);
    ctx.globalAlpha = 1;
    ctx.font = 'italic 19px Georgia, serif';
    ctx.fillStyle = palette.muted;
    textBlock(ctx, slide.imageCaption || 'Public Garden Circle history', x, 731, w, 26, 3);
    if (slide.imageAlt) {
      // Kept in canvas dataset for diagnostics; the full alt text is in the DOM transcript.
      canvas.dataset.imageAlt = slide.imageAlt;
    }
  }

  ctx.globalAlpha = 0.34;
  ctx.fillStyle = palette.accent;
  ctx.fillRect(left, 786, 1412, 1);
  ctx.globalAlpha = 1;
  ctx.font = '600 17px Arial, sans-serif';
  const status = slide.status || 'OPEN SOURCE ORCHESTRA';
  const statusWidth = Math.min(1070, ctx.measureText(status).width + 42);
  ctx.fillStyle = isLight ? 'rgba(65,36,37,.08)' : 'rgba(255,255,255,.055)';
  ctx.beginPath();
  ctx.roundRect(left, 807, statusWidth, 43, 21.5);
  ctx.fill();
  ctx.strokeStyle = palette.accent;
  ctx.globalAlpha = 0.38;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.accent;
  spaced(ctx, status, left + 21, 835, 1.35);
  ctx.textAlign = 'right';
  ctx.font = 'italic 18px Georgia, serif';
  ctx.fillStyle = palette.muted;
  ctx.fillText('A proposal in public · a hall for listening', 1505, 835);
  ctx.textAlign = 'left';
  return canvas;
}

export const SLIDE_CANVAS_SIZE = Object.freeze({ width: WIDTH, height: HEIGHT });
