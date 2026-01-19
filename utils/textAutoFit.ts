import { Bubble, BubbleType } from '../types';

export const SAFE_TEXT_ZONES: Record<BubbleType, { widthFactor: number; heightFactor: number }> = {
  [BubbleType.Shout]: { widthFactor: 0.5, heightFactor: 0.55 },
  [BubbleType.Thought]: { widthFactor: 0.5, heightFactor: 0.65 },
  [BubbleType.SpeechDown]: { widthFactor: 0.83, heightFactor: 0.83 },
  [BubbleType.SpeechUp]: { widthFactor: 0.83, heightFactor: 0.83 },
  [BubbleType.SpeechDownMinimal]: { widthFactor: 0.83, heightFactor: 0.83 },
  [BubbleType.SpeechUpMinimal]: { widthFactor: 0.83, heightFactor: 0.83 },
  [BubbleType.Whisper]: { widthFactor: 0.8, heightFactor: 0.8 },
  [BubbleType.Descriptive]: { widthFactor: 0.9, heightFactor: 0.85 },
  [BubbleType.TextOnly]: { widthFactor: 0.95, heightFactor: 0.9 }
};

export interface TextFitResult {
  fontSize: number;
  textWidth: number;
  textHeight: number;
  fits: boolean;
  scaleFactor: number;
}

export function getTextBounds(bubble: Bubble) {
  const { width, height, type } = bubble;
  let textWidth: number;
  let textHeight: number;
  let textX: number;
  let textY: number;

  if (type === BubbleType.Shout || type === BubbleType.Thought) {
    const safeZone = SAFE_TEXT_ZONES[type];
    textWidth = width * safeZone.widthFactor;
    textHeight = height * safeZone.heightFactor;
    textX = (width - textWidth) / 2;
    textY = (height - textHeight) / 2;
  } else {
    const padding = 10;
    textWidth = width - padding * 2;
    textHeight = height - padding * 2;
    textX = padding;
    textY = padding;
  }

  return { width: textWidth, height: textHeight, x: textX, y: textY };
}

export function measureText(
  text: string,
  fontFamily: string,
  fontSize: number,
  maxWidth: number
): { width: number; height: number; lines: number } {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return { width: maxWidth, height: fontSize * 1.4, lines: 1 };
  }

  ctx.font = `${fontSize}px ${fontFamily}`;
  const plainText = text.replace(/<[^>]*>/g, '');
  const words = plainText.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) lines.push(currentLine);

  const lineHeight = fontSize * 1.4;
  const totalHeight = lines.length * lineHeight;
  const maxLineWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));

  return { width: maxLineWidth, height: totalHeight, lines: lines.length };
}

export function calculateOptimalFontSize(
  text: string,
  bubble: Bubble,
  fontFamily: string,
  minFontSize: number = 8,
  maxFontSize: number = 40
): TextFitResult {
  const textBounds = getTextBounds(bubble);
  const targetFontSize = bubble.fontSize;
  let fontSize = Math.min(targetFontSize, maxFontSize);
  let iterations = 0;
  const maxIterations = 20;

  while (fontSize >= minFontSize && iterations < maxIterations) {
    const dimensions = measureText(text, fontFamily, fontSize, textBounds.width);

    if (dimensions.height <= textBounds.height && dimensions.width <= textBounds.width) {
      return {
        fontSize,
        textWidth: dimensions.width,
        textHeight: dimensions.height,
        fits: true,
        scaleFactor: fontSize / targetFontSize
      };
    }

    fontSize = Math.max(minFontSize, fontSize - 1);
    iterations++;
  }

  const dimensions = measureText(text, fontFamily, minFontSize, textBounds.width);
  return {
    fontSize: minFontSize,
    textWidth: dimensions.width,
    textHeight: dimensions.height,
    fits: dimensions.height <= textBounds.height,
    scaleFactor: minFontSize / targetFontSize
  };
}

export function detectTextOverflow(text: string, bubble: Bubble, fontFamily: string): boolean {
  const textBounds = getTextBounds(bubble);
  const dimensions = measureText(text, fontFamily, bubble.fontSize, textBounds.width);
  return dimensions.height > textBounds.height || dimensions.width > textBounds.width;
}

export function autoFitBubbleText(bubble: Bubble, fontFamily: string): Bubble {
  if (bubble.type === BubbleType.TextOnly || !bubble.text || bubble.text === 'Votre texte ici') {
    return bubble;
  }

  const result = calculateOptimalFontSize(bubble.text, bubble, fontFamily);

  if (result.fontSize === bubble.fontSize) {
    return bubble;
  }

  return { ...bubble, fontSize: result.fontSize };
}
