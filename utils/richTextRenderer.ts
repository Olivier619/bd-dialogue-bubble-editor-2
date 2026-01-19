export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  textColor: string;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethrough: boolean;
}

interface TextSegment {
  text: string;
  style: TextStyle;
  width: number;
  height: number;
}

interface TextLine {
  segments: TextSegment[];
  width: number;
  height: number;
}

function parseRichText(html: string, defaultStyle: TextStyle): TextSegment[] {
  const segments: TextSegment[] = [];
  const lines = html.split(/<br\s*\/?>/gi);
  
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineHtml = lines[lineIdx];
    if (lineHtml.trim()) {
      const plainText = lineHtml.replace(/<[^>]*>/g, '');
      if (plainText) {
        segments.push({
          text: plainText,
          style: { ...defaultStyle },
          width: 0,
          height: 0
        });
      }
    }
    if (lineIdx < lines.length - 1) {
      segments.push({
        text: '\n',
        style: { ...defaultStyle },
        width: 0,
        height: 0
      });
    }
  }

  return segments;
}

function getLineHeightOffset(size: number): number {
  if (size >= 15 && size <= 20) return 6;
  if (size >= 21 && size <= 25) return 4;
  if (size >= 26 && size <= 30) return 1;
  if (size >= 31 && size <= 35) return -1;
  if (size >= 36 && size <= 40) return -3;
  return 6;
}

export async function drawRichText(
  ctx: CanvasRenderingContext2D,
  html: string,
  x: number,
  y: number,
  width: number,
  height: number,
  defaultStyle: TextStyle,
  fontMap: Record<string, string>,
  getMaxWidthAtY?: (y: number) => number
): Promise<void> {
  const segments = parseRichText(html, defaultStyle);

  ctx.save();

  // Measure segments
  segments.forEach((seg) => {
    if (!seg.text) return;
    let fontName = fontMap[seg.style.fontFamily] || seg.style.fontFamily;
    if (!fontName.includes(',')) fontName += ', Arial';

    let fontStr = '';
    if (seg.style.isItalic) fontStr += 'italic ';
    if (seg.style.isBold) fontStr += 'bold ';
    fontStr += `${seg.style.fontSize}px ${fontName}`;

    ctx.font = fontStr;
    seg.width = ctx.measureText(seg.text).width;
    seg.height = seg.style.fontSize;
  });

  // Line wrapping
  const lines: TextLine[] = [];
  let currentLine: TextLine = { segments: [], width: 0, height: 0 };
  let currentY = 0;

  for (const seg of segments) {
    if (seg.text === '\n') {
      lines.push(currentLine);
      currentLine = { segments: [], width: 0, height: 0 };
      currentY += currentLine.height || defaultStyle.fontSize;
      return;
    }

    const words = seg.text.split(/\s+/);
    for (const word of words) {
      const wordWidth = ctx.measureText(word + ' ').width;
      const maxLineWidth = getMaxWidthAtY ? getMaxWidthAtY(currentY) : width;

      if (currentLine.width + wordWidth > maxLineWidth && currentLine.segments.length > 0) {
        lines.push(currentLine);
        currentLine = { segments: [], width: 0, height: 0 };
        currentY += currentLine.height || defaultStyle.fontSize;
      }

      currentLine.segments.push({
        text: word,
        style: seg.style,
        width: wordWidth,
        height: seg.height
      });
      currentLine.width += wordWidth;
      currentLine.height = Math.max(currentLine.height, seg.height);
    }
  }

  if (currentLine.segments.length > 0) {
    lines.push(currentLine);
  }

  // Vertical alignment (center)
  const totalHeight = lines.reduce((acc, line) => acc + line.height, 0);
  const startY = y + (height - totalHeight) / 2;

  // Draw
  let drawY = startY;
  for (const line of lines) {
    let currentX = x + (width - line.width) / 2;
    currentX = Math.max(x, currentX);

    const baselineY = drawY + line.height * 0.8;

    for (const seg of line.segments) {
      if (!seg.text) continue;

      let fontName = fontMap[seg.style.fontFamily] || seg.style.fontFamily;
      if (!fontName.includes(',')) fontName += ', Arial';

      let fontStr = '';
      if (seg.style.isItalic) fontStr += 'italic ';
      if (seg.style.isBold) fontStr += 'bold ';
      fontStr += `${seg.style.fontSize}px ${fontName}`;

      ctx.font = fontStr;
      ctx.fillStyle = seg.style.textColor;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(seg.text, currentX, baselineY);

      // Underline
      if (seg.style.isUnderline) {
        const wordWidth = ctx.measureText(seg.text).width;
        ctx.beginPath();
        ctx.strokeStyle = seg.style.textColor;
        ctx.lineWidth = seg.style.fontSize / 15;
        ctx.moveTo(currentX, baselineY + 2);
        ctx.lineTo(currentX + wordWidth, baselineY + 2);
        ctx.stroke();
      }

      // Strikethrough
      if (seg.style.isStrikethrough) {
        const wordWidth = ctx.measureText(seg.text).width;
        ctx.beginPath();
        ctx.strokeStyle = seg.style.textColor;
        ctx.lineWidth = seg.style.fontSize / 15;
        ctx.moveTo(currentX, baselineY - seg.style.fontSize / 3);
        ctx.lineTo(currentX + wordWidth, baselineY - seg.style.fontSize / 3);
        ctx.stroke();
      }

      currentX += seg.width;
    }

    drawY += line.height;
  }

  ctx.restore();
}
