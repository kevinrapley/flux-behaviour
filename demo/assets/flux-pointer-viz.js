// Pointer visualisations ported from the original playground's pointerviz.js:
// a rolling path preview where the oldest movement fades out, and the motor
// map ("acquisition matrix") plotting every click by path efficiency and
// submovements, coloured green (efficient) through amber to red (poor).
// Coordinates only — nothing about the content under the pointer is stored.

const PATH_WINDOW_MS = 5000;
const SCATTER_MAX_POINTS = 60;

const BAND_COLOURS = {
  GREEN: '#00703c',
  AMBER: '#f47738',
  RED: '#d4351c'
};

function sizeCanvas(canvas, win) {
  const rect = canvas.getBoundingClientRect();
  const ratio = win.devicePixelRatio || 1;
  if (canvas.width !== Math.round(rect.width * ratio)) {
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}

export function initPointerViz(doc, win, { pathCanvasId, scatterCanvasId, ndBand }) {
  const pathCanvas = doc.getElementById(pathCanvasId);
  const scatterCanvas = doc.getElementById(scatterCanvasId);
  if (!pathCanvas || !scatterCanvas) return { addAttempt() {} };

  // ---- Path preview: viewport mapped proportionally into the canvas ----
  const pathBuffer = [];

  doc.addEventListener('pointermove', (e) => {
    pathBuffer.push({ cx: e.clientX, cy: e.clientY, t: performance.now() });
    if (pathBuffer.length > 4000) pathBuffer.splice(0, pathBuffer.length - 4000);
  }, { passive: true, capture: true });

  function drawPath() {
    const { ctx, width, height } = sizeCanvas(pathCanvas, win);
    const now = performance.now();
    while (pathBuffer.length > 0 && now - pathBuffer[0].t > PATH_WINDOW_MS) pathBuffer.shift();

    ctx.clearRect(0, 0, width, height);
    if (pathBuffer.length < 2) return;

    const vw = Math.max(1, win.innerWidth);
    const vh = Math.max(1, win.innerHeight);
    const toX = (cx) => Math.max(0, Math.min(width, (cx / vw) * width));
    const toY = (cy) => Math.max(0, Math.min(height, (cy / vh) * height));

    for (let i = 1; i < pathBuffer.length; i += 1) {
      const a = pathBuffer[i - 1];
      const b = pathBuffer[i];
      const age = Math.max(0, Math.min(1, (now - b.t) / PATH_WINDOW_MS));
      ctx.beginPath();
      ctx.moveTo(toX(a.cx), toY(a.cy));
      ctx.lineTo(toX(b.cx), toY(b.cy));
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(29, 112, 184, ${0.95 - 0.83 * age})`;
      ctx.stroke();
    }

    const head = pathBuffer[pathBuffer.length - 1];
    ctx.beginPath();
    ctx.arc(toX(head.cx), toY(head.cy), 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(29, 112, 184, 0.95)';
    ctx.fill();
  }

  // ---- Acquisition matrix: efficiency (y) vs submovements (x) ----
  const attempts = [];

  function drawScatter() {
    const { ctx, width, height } = sizeCanvas(scatterCanvas, win);
    const pad = { left: 40, right: 10, top: 10, bottom: 26 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const toX = (subs) => pad.left + (Math.min(subs, 60) / 60) * plotW;
    const toY = (eff) => pad.top + (1 - eff) * plotH;

    ctx.clearRect(0, 0, width, height);
    ctx.font = '12px "GDS Transport", arial, sans-serif';

    // Band threshold guides from the nd thresholds.
    ctx.strokeStyle = '#d9d9d9';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    for (const eff of [ndBand.efficiency.green_min, ndBand.efficiency.amber_min]) {
      ctx.beginPath();
      ctx.moveTo(pad.left, toY(eff));
      ctx.lineTo(pad.left + plotW, toY(eff));
      ctx.stroke();
    }
    for (const subs of [ndBand.submovements.green_max, ndBand.submovements.amber_max]) {
      ctx.beginPath();
      ctx.moveTo(toX(subs), pad.top);
      ctx.lineTo(toX(subs), pad.top + plotH);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Axes.
    ctx.fillStyle = '#505a5d';
    for (const eff of [0, 0.5, 1]) {
      ctx.fillText(`${Math.round(eff * 100)}%`, 4, toY(eff) + 4);
    }
    for (const subs of [0, 20, 40, 60]) {
      ctx.fillText(String(subs), toX(subs) - 4, height - 8);
    }

    // Points, oldest faded.
    attempts.forEach((attempt, index) => {
      const recency = (index + 1) / attempts.length;
      const colour = BAND_COLOURS[attempt.band] ?? BAND_COLOURS.RED;
      ctx.beginPath();
      ctx.arc(toX(attempt.submovements), toY(attempt.path_efficiency), 4, 0, Math.PI * 2);
      ctx.globalAlpha = 0.35 + 0.65 * recency;
      ctx.fillStyle = colour;
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  function loop() {
    drawPath();
    win.requestAnimationFrame(loop);
  }
  win.requestAnimationFrame(loop);
  drawScatter();

  return {
    addAttempt(metrics) {
      attempts.push({
        path_efficiency: metrics.path_efficiency,
        submovements: metrics.submovements,
        band: metrics.band
      });
      while (attempts.length > SCATTER_MAX_POINTS) attempts.shift();
      drawScatter();
    }
  };
}
