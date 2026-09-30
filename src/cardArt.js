// Draws each project's trading card on a canvas. The same canvases feed the
// 3D cards (as textures) and the binder (as images), so both always match.
import { TYPES, RARITY_ORDER } from './projects.js';

export const CARD_W = 768;
export const CARD_H = 1076;
const DISPLAY = '"Lilita One", "Arial Rounded MT Bold", sans-serif';
const BODY = 'Rubik, system-ui, sans-serif';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `rgb(${r}, ${g}, ${b})`;
}

function star(ctx, cx, cy, outer, inner, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI / points) * i - Math.PI / 2;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}

function fitText(ctx, text, maxW, size, font) {
  let s = size;
  ctx.font = `${s}px ${font}`;
  while (ctx.measureText(text).width > maxW && s > 20) {
    s -= 2;
    ctx.font = `${s}px ${font}`;
  }
  return s;
}

/* ---------- Art for each project (drawn inside the art window) ---------- */

const ART = {
  marginalia(ctx, x, y, w, h) {
    ctx.fillStyle = '#EFE5D3';
    ctx.fillRect(x, y, w, h);
    const gutter = ctx.createLinearGradient(x, 0, x + 70, 0);
    gutter.addColorStop(0, 'rgba(60, 40, 20, .28)');
    gutter.addColorStop(1, 'rgba(60, 40, 20, 0)');
    ctx.fillStyle = gutter;
    ctx.fillRect(x, y, 70, h);
    const left = x + 72, right = x + w - 190;
    const r = rng(11);
    const lines = [];
    for (let i = 0, ly = y + 58; i < 12; i++, ly += 37) {
      const full = right - left;
      lines.push([ly, i % 4 === 3 ? full * (0.45 + r() * 0.2) : full * (0.86 + r() * 0.14)]);
    }
    const hl = [[1, 'rgba(243, 223, 85, .9)'], [4, 'rgba(147, 219, 139, .85)'], [5, 'rgba(147, 219, 139, .85)'], [8, 'rgba(134, 197, 240, .9)']];
    for (const [i, c] of hl) {
      ctx.save();
      ctx.translate(left - 8, lines[i][0] - 15);
      ctx.rotate(-0.012);
      ctx.fillStyle = c;
      rr(ctx, 0, 0, lines[i][1] + 16, 28, 7);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#3A3631';
    for (const [ly, len] of lines) {
      const r2 = rng(ly * 7);
      let cx = left;
      while (cx < left + len) {
        const ww = Math.min(16 + r2() * 64, left + len - cx);
        ctx.fillRect(cx, ly - 5, ww, 10);
        cx += ww + 11;
      }
    }
    // star in the margin
    star(ctx, right + 86, lines[1][0], 30, 13);
    ctx.fillStyle = '#F5A623';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#3A3631';
    ctx.stroke();
    // pen note: a bracket and a scribbled note
    ctx.strokeStyle = '#2143B0';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(right + 34, lines[4][0] - 18);
    ctx.lineTo(right + 24, lines[4][0] - 18);
    ctx.lineTo(right + 24, lines[5][0] + 12);
    ctx.lineTo(right + 34, lines[5][0] + 12);
    ctx.stroke();
    const scrib = (sx, sy, len, seed) => {
      const rs = rng(seed);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      for (let t = 0; t < len; t += 12) {
        ctx.quadraticCurveTo(sx + t + 6, sy - 10 - rs() * 10, sx + t + 12, sy + (rs() - 0.5) * 6);
      }
      ctx.stroke();
    };
    scrib(right + 50, lines[7][0] + 4, 110, 3);
    scrib(right + 50, lines[8][0] + 10, 90, 5);
    scrib(right + 50, lines[9][0] + 16, 70, 9);
  },

  'wps-clubs'(ctx, x, y, w, h) {
    ctx.fillStyle = '#0B1B33';
    ctx.fillRect(x, y, w, h);
    // week board
    const bh = h * 0.24;
    ctx.fillStyle = '#081426';
    ctx.fillRect(x, y, w, bh);
    const days = ['M', 'T', 'W', 'T', 'F'];
    const colW = w / 5;
    const r = rng(4);
    days.forEach((d, i) => {
      ctx.fillStyle = '#9FB8D6';
      ctx.font = `700 24px ${BODY}`;
      ctx.fillText(d, x + i * colW + 18, y + 38);
      const chips = 1 + Math.floor(r() * 2);
      for (let c = 0; c < chips; c++) {
        ctx.fillStyle = c === 0 ? '#7FB2E5' : '#2F6DB5';
        rr(ctx, x + i * colW + 16, y + 56 + c * 34, colW - 32, 24, 12);
        ctx.fill();
      }
    });
    // mosaic sized by membership
    const tiles = [
      [0, 0, 0.44, 0.58, '#7FB2E5'], [0.44, 0, 0.32, 0.34, '#2F6DB5'], [0.76, 0, 0.24, 0.34, '#C9DDF2'],
      [0.44, 0.34, 0.22, 0.24, '#1E4F8F'], [0.66, 0.34, 0.34, 0.24, '#5A93D1'], [0, 0.58, 0.26, 0.42, '#2F6DB5'],
      [0.26, 0.58, 0.3, 0.42, '#C9DDF2'], [0.56, 0.58, 0.2, 0.22, '#7FB2E5'], [0.76, 0.58, 0.24, 0.22, '#1E4F8F'],
      [0.56, 0.8, 0.44, 0.2, '#5A93D1'],
    ];
    const my = y + bh + 10, mh = h - bh - 10, gap = 8;
    for (const [tx, ty, tw, th, c] of tiles) {
      const px = x + tx * w + gap / 2, py = my + ty * mh + gap / 2;
      const pw = tw * w - gap, ph = th * mh - gap;
      const g = ctx.createLinearGradient(px, py, px + pw, py + ph);
      g.addColorStop(0, c);
      g.addColorStop(1, shade(c.length === 7 ? c : '#5A93D1', -0.35));
      ctx.fillStyle = g;
      rr(ctx, px, py, pw, ph, 12);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, .85)';
      rr(ctx, px + 14, py + ph - 30, Math.min(pw - 28, 120), 14, 7);
      ctx.fill();
    }
  },

  roblox(ctx, x, y, w, h) {
    const sky = ctx.createLinearGradient(0, y, 0, y + h * 0.36);
    sky.addColorStop(0, '#070A14');
    sky.addColorStop(1, '#121A33');
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, w, h * 0.36);
    // neon platforms
    const plats = [[0.1, 0.2, '#37D99E'], [0.42, 0.12, '#45A6FF'], [0.72, 0.24, '#FFE55C']];
    for (const [px, py, c] of plats) {
      ctx.save();
      ctx.shadowColor = c;
      ctx.shadowBlur = 26;
      ctx.fillStyle = c;
      const X = x + px * w, Y = y + py * h;
      ctx.beginPath();
      ctx.moveTo(X, Y);
      ctx.lineTo(X + 130, Y);
      ctx.lineTo(X + 160, Y + 22);
      ctx.lineTo(X + 30, Y + 22);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // checkpoint flag
    ctx.fillStyle = '#F2553D';
    ctx.fillRect(x + 0.72 * w + 70, y + 0.24 * h - 60, 5, 60);
    ctx.beginPath();
    ctx.moveTo(x + 0.72 * w + 75, y + 0.24 * h - 60);
    ctx.lineTo(x + 0.72 * w + 115, y + 0.24 * h - 48);
    ctx.lineTo(x + 0.72 * w + 75, y + 0.24 * h - 36);
    ctx.fill();
    // seven rarity layers
    const bands = ['#6B6F76', '#4FB477', '#3F8CFF', '#8E6BFF', '#F5A623', '#F2553D', '#7FF3FF'];
    const top = y + h * 0.36;
    const bandH = (h - h * 0.36) / bands.length;
    const r = rng(21);
    bands.forEach((c, i) => {
      const by = top + i * bandH;
      ctx.fillStyle = shade(c, -0.55);
      ctx.fillRect(x, by, w, bandH + 1);
      for (let bx = 0; bx < w; bx += 32) {
        if (r() < 0.55) {
          ctx.fillStyle = r() < 0.5 ? shade(c, -0.35) : shade(c, -0.7);
          ctx.fillRect(x + bx + 2, by + 2 + r() * (bandH - 28), 26, 24);
        }
      }
      ctx.fillStyle = c;
      ctx.fillRect(x, by, w, 3);
    });
    // the diamond
    const dx = x + w * 0.5, dy = top + bandH * 6.1;
    ctx.save();
    ctx.shadowColor = '#7FF3FF';
    ctx.shadowBlur = 40;
    ctx.fillStyle = '#B8FAFF';
    ctx.beginPath();
    ctx.moveTo(dx - 44, dy);
    ctx.lineTo(dx - 26, dy - 22);
    ctx.lineTo(dx + 26, dy - 22);
    ctx.lineTo(dx + 44, dy);
    ctx.lineTo(dx, dy + 52);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(20, 90, 110, .55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(dx - 44, dy); ctx.lineTo(dx + 44, dy);
    ctx.moveTo(dx - 26, dy - 22); ctx.lineTo(dx - 12, dy); ctx.lineTo(dx, dy + 52);
    ctx.moveTo(dx + 26, dy - 22); ctx.lineTo(dx + 12, dy); ctx.lineTo(dx, dy + 52);
    ctx.stroke();
  },

  atlas(ctx, x, y, w, h) {
    ctx.fillStyle = '#0D1117';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#161B22';
    ctx.fillRect(x, y, 58, h);
    const colors = ['#79C0FF', '#FFA657', '#D2A8FF', '#A5D6FF', '#7EE787', '#C9D1D9'];
    const r = rng(8);
    const rows = 9;
    for (let i = 0; i < rows; i++) {
      const ly = y + 40 + i * 44;
      if (i === 4) {
        ctx.fillStyle = 'rgba(55, 217, 158, .16)';
        ctx.fillRect(x + 58, ly - 22, w - 58, 44);
        ctx.fillStyle = '#37D99E';
        ctx.fillRect(x + 58, ly - 22, 4, 44);
        ctx.fillStyle = '#37D99E';
        ctx.font = `700 26px ${BODY}`;
        ctx.fillText('+', x + 22, ly + 9);
      } else {
        ctx.fillStyle = '#484F58';
        ctx.fillRect(x + 20, ly - 5, 20, 10);
      }
      let cx = x + 80 + (i % 3) * 30;
      const n = 2 + Math.floor(r() * 4);
      for (let t = 0; t < n; t++) {
        const tw = 30 + r() * 90;
        ctx.fillStyle = colors[Math.floor(r() * colors.length)];
        rr(ctx, cx, ly - 7, tw, 14, 7);
        ctx.fill();
        cx += tw + 14;
        if (cx > x + w - 60) break;
      }
    }
    // the note
    const nx = x + 110, ny = y + 262, nw = w - 150, nh = 150;
    ctx.strokeStyle = '#37D99E';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(nx + 30, y + 240);
    ctx.lineTo(nx + 30, ny);
    ctx.stroke();
    ctx.fillStyle = '#161B22';
    rr(ctx, nx, ny, nw, nh, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#37D99E';
    ctx.font = `700 26px ${BODY}`;
    ctx.fillText('Atlas', nx + 24, ny + 44);
    ctx.fillStyle = '#C9D1D9';
    [0.92, 0.8, 0.55].forEach((f, i) => {
      rr(ctx, nx + 24, ny + 68 + i * 26, (nw - 48) * f, 12, 6);
      ctx.fill();
    });
  },

  'sixteen-hundred'(ctx, x, y, w, h) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#3A77FF');
    g.addColorStop(1, '#1B47C9');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `180px ${DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.fillText('1600', x + w / 2, y + 190);
    ctx.textAlign = 'left';
    const opts = ['A', 'B', 'C', 'D'];
    opts.forEach((o, i) => {
      const oy = y + 240 + i * 66;
      const right = i === 2;
      ctx.fillStyle = right ? '#2FE07C' : 'rgba(255, 255, 255, .92)';
      rr(ctx, x + 60, oy, w - 120, 52, 16);
      ctx.fill();
      ctx.fillStyle = right ? '#0B3D22' : '#1B47C9';
      ctx.beginPath();
      ctx.arc(x + 96, oy + 26, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = right ? '#2FE07C' : '#FFFFFF';
      ctx.font = `700 20px ${BODY}`;
      ctx.textAlign = 'center';
      ctx.fillText(o, x + 96, oy + 33);
      ctx.textAlign = 'left';
      ctx.fillStyle = right ? 'rgba(11, 61, 34, .55)' : 'rgba(27, 71, 201, .35)';
      rr(ctx, x + 132, oy + 20, (w - 260) * (0.5 + ((i * 37) % 40) / 100), 12, 6);
      ctx.fill();
    });
  },

  'quick-math'(ctx, x, y, w, h) {
    ctx.fillStyle = '#10131E';
    ctx.fillRect(x, y, w, h);
    // card stack sliding up
    ctx.fillStyle = 'rgba(69, 166, 255, .18)';
    rr(ctx, x + 110, y + 36, w - 220, 70, 20);
    ctx.fill();
    ctx.fillStyle = 'rgba(69, 166, 255, .35)';
    rr(ctx, x + 80, y + 62, w - 160, 70, 22);
    ctx.fill();
    ctx.save();
    ctx.shadowColor = 'rgba(69, 166, 255, .6)';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#F5F7FB';
    rr(ctx, x + 50, y + 92, w - 100, 180, 26);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#10131E';
    ctx.font = `104px ${DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.fillText('47 × 6', x + w / 2, y + 222);
    // number pad
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const kw = (w - 160) / 3, kh = 52;
    keys.forEach((k, i) => {
      const kx = x + 80 + (i % 3) * kw, ky = y + 300 + Math.floor(i / 3) * (kh + 10);
      ctx.fillStyle = '#1E2436';
      rr(ctx, kx + 6, ky, kw - 12, kh, 14);
      ctx.fill();
      ctx.fillStyle = '#C9D3E0';
      ctx.font = `700 26px ${BODY}`;
      ctx.fillText(k, kx + kw / 2, ky + 35);
    });
    ctx.textAlign = 'left';
  },

  arise(ctx, x, y, w, h) {
    const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 20, x + w / 2, y + h / 2, w * 0.7);
    g.addColorStop(0, '#0D1C46');
    g.addColorStop(1, '#04060D');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    const wx = x + 70, wy = y + 60, ww = w - 140, wh = h - 120;
    ctx.save();
    ctx.shadowColor = '#45A6FF';
    ctx.shadowBlur = 36;
    ctx.strokeStyle = '#7CC6FF';
    ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(30, 80, 170, .32)';
    rr(ctx, wx, wy, ww, wh, 10);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#BFE6FF';
    ctx.font = `700 22px ${BODY}`;
    ctx.textAlign = 'center';
    ctx.fillText('QUEST INFO', x + w / 2, wy + 44);
    ctx.fillStyle = 'rgba(124, 198, 255, .6)';
    ctx.fillRect(wx + 30, wy + 62, ww - 60, 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `46px ${DISPLAY}`;
    ctx.fillText('DAILY QUEST', x + w / 2, wy + 120);
    ctx.textAlign = 'left';
    const rows = [['Push-ups', '0/100'], ['Sit-ups', '0/100'], ['Run', '0/10 km']];
    rows.forEach(([a, b], i) => {
      const ry = wy + 178 + i * 50;
      ctx.fillStyle = '#D6ECFF';
      ctx.font = `500 26px ${BODY}`;
      ctx.fillText(a, wx + 44, ry);
      ctx.textAlign = 'right';
      ctx.fillText(b, wx + ww - 44, ry);
      ctx.textAlign = 'left';
    });
    ctx.fillStyle = 'rgba(124, 198, 255, .25)';
    rr(ctx, wx + 44, wy + wh - 58, ww - 88, 14, 7);
    ctx.fill();
    ctx.fillStyle = '#7CC6FF';
    rr(ctx, wx + 44, wy + wh - 58, (ww - 88) * 0.34, 14, 7);
    ctx.fill();
  },

  'first-python'(ctx, x, y, w, h) {
    ctx.fillStyle = '#0B0F14';
    ctx.fillRect(x, y, w, h);
    const inv = ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000'];
    const s = 30;
    const ox = x + (w - s * 11) / 2, oy = y + 50;
    ctx.save();
    ctx.shadowColor = '#FFE55C';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#FFE55C';
    inv.forEach((row, j) => [...row].forEach((c, i) => {
      if (c === '1') ctx.fillRect(ox + i * s, oy + j * s, s - 3, s - 3);
    }));
    ctx.restore();
    // shots
    ctx.fillStyle = '#FFE55C';
    ctx.fillRect(x + w / 2 - 3, oy + 8 * s + 20, 6, 22);
    ctx.fillRect(x + w / 2 - 3, oy + 8 * s + 60, 6, 22);
    // snake
    const snake = [[2, 0], [3, 0], [4, 0], [5, 0], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1]];
    const sy = y + h - 120;
    snake.forEach(([i, j], k) => {
      ctx.fillStyle = k === snake.length - 1 ? '#6FA8DC' : '#3776AB';
      ctx.fillRect(x + 60 + i * 34, sy + j * 34, 30, 30);
    });
    ctx.fillStyle = '#FFE55C';
    ctx.fillRect(x + 60 + 13 * 34, sy + 34, 30, 30);
    ctx.fillStyle = '#8A93A3';
    ctx.font = `500 22px ${BODY}`;
    ctx.fillText('blockInvaders.py', x + 24, y + h - 20);
  },
};

/* ---------- Template art: a gem that grows with the card's rarity ---------- */

function sparkle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

function gem(ctx, cx, cy, c, tier) {
  const w = 120 + tier * 22, h = w * 1.05;
  const top = cy - h * 0.5, girdle = cy - h * 0.12, bottom = cy + h * 0.62;
  if (tier === 4) {
    ctx.save();
    ctx.strokeStyle = c;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 6;
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * w * 1.25, cy + Math.sin(a) * w * 1.25);
      ctx.lineTo(cx + Math.cos(a) * w * 1.75, cy + Math.sin(a) * w * 1.75);
      ctx.stroke();
    }
    ctx.restore();
  }
  const body = ctx.createLinearGradient(cx - w, top, cx + w, bottom);
  body.addColorStop(0, shade(c, 0.45));
  body.addColorStop(0.5, c);
  body.addColorStop(1, shade(c, -0.5));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.42, top);
  ctx.lineTo(cx + w * 0.42, top);
  ctx.lineTo(cx + w, girdle);
  ctx.lineTo(cx, bottom);
  ctx.lineTo(cx - w, girdle);
  ctx.closePath();
  ctx.fill();
  // facets
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255, 255, 255, .28)';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.42, top);
  ctx.lineTo(cx, top);
  ctx.lineTo(cx - w * 0.45, girdle);
  ctx.lineTo(cx - w, girdle);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, .6)';
  ctx.lineWidth = 3.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - w, girdle); ctx.lineTo(cx + w, girdle);
  ctx.moveTo(cx - w * 0.42, top); ctx.lineTo(cx - w * 0.45, girdle); ctx.lineTo(cx, top); ctx.lineTo(cx + w * 0.45, girdle); ctx.lineTo(cx + w * 0.42, top);
  ctx.moveTo(cx - w * 0.45, girdle); ctx.lineTo(cx, bottom); ctx.lineTo(cx + w * 0.45, girdle);
  ctx.stroke();
  ctx.restore();
  // sparkles: one more per tier
  ctx.fillStyle = '#FFFFFF';
  const spots = [[1.05, -0.55, 22], [-1.1, 0.35, 16], [0.95, 0.55, 14], [-0.75, -0.75, 18]];
  spots.slice(0, tier).forEach(([dx, dy, r]) => sparkle(ctx, cx + dx * w, cy + dy * w, r));
}

function rarityPips(ctx, cx, y, c, tier) {
  for (let i = 0; i < 5; i++) {
    const x = cx + (i - 2) * 34;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = i <= tier ? c : 'rgba(255, 255, 255, .14)';
    ctx.fillRect(-9, -9, 18, 18);
    ctx.restore();
  }
}

function templateArt(p) {
  return (ctx, x, y, w, h) => {
    const color = TYPES[p.type].color;
    ctx.fillStyle = '#0B0E15';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255, 255, 255, .05)';
    ctx.lineWidth = 2;
    for (let gx = x; gx < x + w; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke(); }
    for (let gy = y; gy < y + h; gy += 40) { ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke(); }
    const glow = ctx.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, w * 0.55);
    glow.addColorStop(0, `${color}40`);
    glow.addColorStop(1, `${color}00`);
    ctx.fillStyle = glow;
    ctx.fillRect(x, y, w, h);
    const tier = Math.max(0, RARITY_ORDER.indexOf(p.type));
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 40;
    gem(ctx, x + w / 2, y + h / 2 - 40, color, tier);
    ctx.restore();
    rarityPips(ctx, x + w / 2, y + h - 104, color, tier);
    ctx.fillStyle = 'rgba(14, 16, 22, .75)';
    ctx.beginPath(); ctx.roundRect(x + w / 2 - 110, y + h - 62, 220, 40, 20); ctx.fill();
    ctx.fillStyle = '#E4E8EF';
    ctx.font = `700 20px ${BODY}`;
    ctx.textAlign = 'center';
    ctx.fillText('TEMPLATE ART', x + w / 2, y + h - 35);
    ctx.textAlign = 'left';
  };
}

/* ---------- Card faces ---------- */

export function drawFront(p) {
  const c = document.createElement('canvas');
  c.width = CARD_W;
  c.height = CARD_H;
  const ctx = c.getContext('2d');
  const type = TYPES[p.type];
  const W = CARD_W, H = CARD_H;

  // frame: the rarity color, lit from the top left
  const frame = ctx.createLinearGradient(0, 0, W, H);
  frame.addColorStop(0, shade(type.color, 0.35));
  frame.addColorStop(0.5, type.color);
  frame.addColorStop(1, shade(type.color, -0.45));
  ctx.fillStyle = frame;
  rr(ctx, 0, 0, W, H, 44);
  ctx.fill();
  ctx.fillStyle = '#121620';
  rr(ctx, 24, 24, W - 48, H - 48, 30);
  ctx.fill();

  // title and type badge
  ctx.font = `700 26px ${BODY}`;
  const badge = type.label.toUpperCase();
  const bw = ctx.measureText(badge).width + 40;
  ctx.fillStyle = type.color;
  rr(ctx, W - 52 - bw, 58, bw, 46, 23);
  ctx.fill();
  ctx.fillStyle = '#0E1016';
  ctx.fillText(badge, W - 52 - bw + 20, 90);
  const size = fitText(ctx, p.title, W - 150 - bw, 78, DISPLAY);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `${size}px ${DISPLAY}`;
  ctx.fillText(p.title, 54, 108);

  // art window
  const ax = 48, ay = 136, aw = W - 96, ah = 540;
  ctx.save();
  rr(ctx, ax, ay, aw, ah, 22);
  ctx.clip();
  (ART[p.id] || templateArt(p))(ctx, ax, ay, aw, ah);
  const sheen = ctx.createLinearGradient(ax, ay, ax + aw, ay + ah);
  sheen.addColorStop(0, 'rgba(255, 255, 255, .12)');
  sheen.addColorStop(0.4, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(ax, ay, aw, ah);
  ctx.restore();
  ctx.strokeStyle = type.color;
  ctx.lineWidth = 5;
  rr(ctx, ax, ay, aw, ah, 22);
  ctx.stroke();

  // month and stack
  ctx.fillStyle = '#9AA3B2';
  ctx.font = `500 27px ${BODY}`;
  ctx.fillText(`${p.month}  ·  ${p.stack}`, 56, ay + ah + 58);

  // the one real number
  ctx.fillStyle = type.color;
  const bigSize = fitText(ctx, p.stat.big, 300, 112, DISPLAY);
  ctx.font = `${bigSize}px ${DISPLAY}`;
  ctx.fillText(p.stat.big, 54, ay + ah + 186);
  const bigW = ctx.measureText(p.stat.big).width;
  ctx.fillStyle = '#E4E8EF';
  ctx.font = `500 30px ${BODY}`;
  const words = p.stat.small.split(' ');
  let line = '', ly = ay + ah + 136;
  const maxW = W - 120 - bigW - 36;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, 54 + bigW + 32, ly);
      line = word;
      ly += 38;
    } else line = test;
  }
  ctx.fillText(line, 54 + bigW + 32, ly);

  // footer
  ctx.fillStyle = 'rgba(255, 255, 255, .1)';
  ctx.fillRect(54, H - 104, W - 108, 2);
  ctx.fillStyle = '#6B7385';
  ctx.font = `700 22px ${BODY}`;
  ctx.fillText('ARMAAN K.', 56, H - 62);
  ctx.textAlign = 'right';
  ctx.fillText(`NO. ${p.no} / 8`, W - 56, H - 62);
  ctx.textAlign = 'left';
  return c;
}

// White where the foil catches light: the frame and the big number.
export function drawFoilMask(p) {
  const c = document.createElement('canvas');
  c.width = CARD_W / 2;
  c.height = CARD_H / 2;
  const ctx = c.getContext('2d');
  ctx.scale(0.5, 0.5);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = '#fff';
  rr(ctx, 0, 0, CARD_W, CARD_H, 44);
  ctx.fill();
  ctx.fillStyle = '#000';
  rr(ctx, 24, 24, CARD_W - 48, CARD_H - 48, 30);
  ctx.fill();
  ctx.fillStyle = '#b0b0b0';
  ctx.font = `112px ${DISPLAY}`;
  ctx.fillText(p.stat.big, 54, 136 + 540 + 186);
  return c;
}

export function drawBack() {
  const c = document.createElement('canvas');
  c.width = CARD_W;
  c.height = CARD_H;
  const ctx = c.getContext('2d');
  const W = CARD_W, H = CARD_H;
  const gold = ctx.createLinearGradient(0, 0, W, H);
  gold.addColorStop(0, '#FFD27A');
  gold.addColorStop(0.5, '#F5A623');
  gold.addColorStop(1, '#9C5F0B');
  ctx.fillStyle = gold;
  rr(ctx, 0, 0, W, H, 44);
  ctx.fill();
  ctx.fillStyle = '#171B24';
  rr(ctx, 24, 24, W - 48, H - 48, 30);
  ctx.fill();
  ctx.save();
  rr(ctx, 24, 24, W - 48, H - 48, 30);
  ctx.clip();
  ctx.strokeStyle = 'rgba(245, 166, 35, .09)';
  ctx.lineWidth = 14;
  for (let i = -H; i < W + H; i += 46) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + H, H);
    ctx.stroke();
  }
  ctx.restore();
  // chest emblem
  const cx = W / 2, cy = H / 2 - 40;
  ctx.fillStyle = '#2B3342';
  rr(ctx, cx - 190, cy - 20, 380, 190, 22);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy - 20, 190, 120, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#F5A623';
  for (const bx of [-130, 100]) {
    ctx.fillRect(cx + bx, cy - 130, 30, 300);
  }
  ctx.fillRect(cx - 196, cy - 30, 392, 22);
  rr(ctx, cx - 36, cy - 26, 72, 90, 12);
  ctx.fill();
  ctx.fillStyle = '#171B24';
  ctx.beginPath();
  ctx.arc(cx, cy + 12, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - 5, cy + 12, 10, 26);
  ctx.fillStyle = '#F5A623';
  ctx.font = `76px ${DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.fillText('ARMAAN K.', cx, cy + 300);
  ctx.fillStyle = '#8A93A3';
  ctx.font = `500 30px ${BODY}`;
  ctx.fillText('8 projects inside', cx, cy + 352);
  ctx.textAlign = 'left';
  return c;
}
