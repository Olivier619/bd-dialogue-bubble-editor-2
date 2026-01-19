import { Bubble, BubbleType, SpeechTailPart, ThoughtDotPart } from '../types';

export interface BubblePaths {
  bodyPath: string;
  partsCircles: Array<{ id: string; cx: number; cy: number; r: number }>;
}

export function generateBubblePaths(bubble: Bubble): BubblePaths {
  const { width: w, height: h, type, parts } = bubble;
  const paths: BubblePaths = { bodyPath: '', partsCircles: [] };

  let r = 20;
  if (type === BubbleType.SpeechDown || type === BubbleType.SpeechUp || type === BubbleType.Whisper) {
    r = Math.min(w, h) / 2;
  } else if (type === BubbleType.Descriptive) {
    r = 5;
  }

  if (type === BubbleType.SpeechDown || type === BubbleType.SpeechUp || type === BubbleType.Whisper) {
    const tail = parts.find((p) => p.type === 'speech-tail') as SpeechTailPart | undefined;
    if (tail) {
      const { baseCX, baseCY, baseWidth, tipX, tipY } = tail;
      const halfBase = baseWidth / 2;
      const clampedBaseCX = Math.max(0, Math.min(w, baseCX));
      const clampedBaseCY = Math.max(0, Math.min(h, baseCY));

      const createTailPath = (startPt: { x: number; y: number }, endPt: { x: number; y: number }) => {
        const midY = clampedBaseCY + (tipY - clampedBaseCY) * 0.5;
        return `L ${startPt.x},${startPt.y} Q ${startPt.x} ${tipX - startPt.x} 0.25,${midY} ${tipX},${tipY} Q ${endPt.x} ${tipX - endPt.x} 0.25,${midY} ${endPt.x},${endPt.y}`;
      };

      if (clampedBaseCY === h) {
        const leftBaseX = Math.max(r, clampedBaseCX - halfBase);
        const rightBaseX = Math.min(w - r, clampedBaseCX + halfBase);
        paths.bodyPath = `M ${r},0 L ${w - r},0 A ${r},${r} 0 0 1 ${w},${r} L ${w},${h - r} A ${r},${r} 0 0 1 ${w - r},${h} L ${rightBaseX},${h} ${createTailPath(
          { x: rightBaseX, y: h },
          { x: leftBaseX, y: h }
        )} L ${r},${h} A ${r},${r} 0 0 1 0,${h - r} L 0,${r} A ${r},${r} 0 0 1 ${r},0 Z`;
      } else if (clampedBaseCY === 0) {
        const leftBaseX = Math.max(r, clampedBaseCX - halfBase);
        const rightBaseX = Math.min(w - r, clampedBaseCX + halfBase);
        paths.bodyPath = `M ${r},0 L ${leftBaseX},0 ${createTailPath(
          { x: leftBaseX, y: 0 },
          { x: rightBaseX, y: 0 }
        )} L ${w - r},0 A ${r},${r} 0 0 1 ${w},${r} L ${w},${h - r} A ${r},${r} 0 0 1 ${w - r},${h} L ${r},${h} A ${r},${r} 0 0 1 0,${h - r} L 0,${r} A ${r},${r} 0 0 1 ${r},0 Z`;
      }
    }
  } else if (type === BubbleType.Thought) {
    const cx = w / 2;
    const cy = h / 2;
    const rx = w * 0.3;
    const ry = h * 0.3;
    const lobes = 9;
    let path = '';

    for (let i = 0; i < lobes; i++) {
      const angle = (i / lobes) * Math.PI * 2 - Math.PI / 2;
      const nextAngle = ((i + 1) / lobes) * Math.PI * 2 - Math.PI / 2;
      const x1 = cx + rx * Math.cos(angle);
      const y1 = cy + ry * Math.sin(angle);
      const x2 = cx + rx * Math.cos(nextAngle);
      const y2 = cy + ry * Math.sin(nextAngle);

      if (i === 0) path = `M ${x1},${y1}`;
      const midAngle = (angle + nextAngle) / 2;
      const bulgeFactor = 1.4;
      const cpx = cx + rx * bulgeFactor * Math.cos(midAngle);
      const cpy = cy + ry * bulgeFactor * Math.sin(midAngle);
      path += ` Q ${cpx},${cpy} ${x2},${y2}`;
    }
    paths.bodyPath = path + ' Z';

    parts.forEach((part) => {
      if (part.type === 'thought-dot') {
        const dotPart = part as ThoughtDotPart;
        paths.partsCircles.push({
          id: part.id,
          cx: dotPart.offsetX,
          cy: dotPart.offsetY,
          r: dotPart.size / 2
        });
      }
    });
  } else if (type === BubbleType.Shout) {
    const points = 14;
    const cx = w / 2;
    const cy = h / 2;
    const outerRx = w / 2;
    const outerRy = h / 2;
    const innerRx = w / 3.5;
    const innerRy = h / 3.5;
    let path = '';

    for (let i = 0; i < points * 2; i++) {
      const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const isOuter = i % 2 === 0;
      const currRx = isOuter ? outerRx : innerRx;
      const currRy = isOuter ? outerRy : innerRy;
      const px = cx + currRx * Math.cos(angle);
      const py = cy + currRy * Math.sin(angle);
      path += i === 0 ? `M ${px},${py}` : ` L ${px},${py}`;
    }
    paths.bodyPath = path + ' Z';
  } else {
    // Descriptive or TextOnly
    paths.bodyPath = `M ${r},0 L ${w - r},0 A ${r},${r} 0 0 1 ${w},${r} L ${w},${h - r} A ${r},${r} 0 0 1 ${w - r},${h} L ${r},${h} A ${r},${r} 0 0 1 0,${h - r} L 0,${r} A ${r},${r} 0 0 1 ${r},0 Z`;
  }

  return paths;
}

export function getOverallBbox(bubble: Bubble) {
  let minX = 0,
    minY = 0,
    maxX = bubble.width,
    maxY = bubble.height;

  bubble.parts.forEach((part) => {
    if (part.type === 'speech-tail') {
      const tailPart = part as SpeechTailPart;
      minX = Math.min(minX, tailPart.tipX);
      maxX = Math.max(maxX, tailPart.tipX);
      minY = Math.min(minY, tailPart.tipY);
      maxY = Math.max(maxY, tailPart.tipY);
    } else if (part.type === 'thought-dot') {
      const dotPart = part as ThoughtDotPart;
      minX = Math.min(minX, dotPart.offsetX - dotPart.size / 2);
      maxX = Math.max(maxX, dotPart.offsetX + dotPart.size / 2);
      minY = Math.min(minY, dotPart.offsetY - dotPart.size / 2);
      maxY = Math.max(maxY, dotPart.offsetY + dotPart.size / 2);
    }
  });

  const padding = 10;
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX + padding - minX,
    height: maxY + padding - minY
  };
}
