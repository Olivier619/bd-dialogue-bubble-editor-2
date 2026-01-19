import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Bubble, BubblePart, MIN_BUBBLE_WIDTH, MIN_BUBBLE_HEIGHT, FONTFAMILYMAP, BubbleType, FontName, SpeechTailPart, ThoughtDotPart } from '../types.ts';
import { generateBubblePaths, getOverallBbox } from '../utils/bubbleUtils';
import { detectTextOverflow, getTextBounds, SAFE_TEXT_ZONES } from '../utils/textAutoFit';

interface BubbleItemProps {
  bubble: Bubble;
  isSelected: boolean;
  onSelect: (id: string | null) => void;
  onUpdate: (updatedBubble: Bubble) => void;
  onDelete: (id: string) => void;
  isSaving: boolean;
  canvasBounds: DOMRect | null;
}

export type BubbleItemHandle = {
  applyStyleToSelection: (style: 'fontFamily' | 'fontSize', value: FontName | number) => boolean;
  enterEditMode: () => void;
};

const HANDLE_SIZE = 10;
const HANDLE_OFFSET = HANDLE_SIZE / 2;
const TAIL_TIP_HANDLE_RADIUS = 7;
const TAIL_BASE_HANDLE_RADIUS = 9;
const BUBBLE_BORDER_WIDTH = 2;
const MIN_FONT_SIZE = 5;
const MAX_FONT_SIZE = 40;

type InteractionMode = 'move' | 'resize' | 'move-part' | 'move-tail-tip' | 'move-tail-base' | null;
type ActiveHandle = 'tl' | 'tc' | 'tr' | 'ml' | 'mr' | 'bl' | 'bc' | 'br' | null;

export const BubbleItem = forwardRef<BubbleItemHandle, BubbleItemProps>(
  ({ bubble, isSelected, onSelect, onUpdate, onDelete, isSaving, canvasBounds }, ref) => {
    const [isEditingText, setIsEditingText] = useState(false);
    const textEditRef = useRef<HTMLDivElement>(null);
    const [interaction, setInteraction] = useState<{
      mode: InteractionMode;
      activeHandle: ActiveHandle;
      activePartId: string | null;
      startX: number;
      startY: number;
      initialBubbleX: number;
      initialBubbleY: number;
      initialBubbleWidth: number;
      initialBubbleHeight: number;
      initialPartOffsetX?: number;
      initialPartOffsetY?: number;
      initialTipX?: number;
      initialTipY?: number;
      initialBaseCX?: number;
      initialBaseCY?: number;
    } | null>(null);

    const applyStyleToCurrentSelection = useCallback(
      (style: 'fontFamily' | 'fontSize', value: FontName | number): boolean => {
        if (!isEditingText || !textEditRef.current) return false;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return false;
        const range = selection.getRangeAt(0);
        if (!textEditRef.current.contains(range.commonAncestorContainer)) return false;

        if (style === 'fontSize') {
          const sizePx = `${value}px`;
          const marker = '7';
          document.execCommand('fontSize', false, marker);
          const fontElements = textEditRef.current.getElementsByTagName('font');
          let replaced = false;
          Array.from(fontElements).forEach(element => {
            const fontEl = element as any;
            if (fontEl.getAttribute('size') === marker) {
              const span = document.createElement('span');
              span.style.fontSize = sizePx;
              span.innerHTML = fontEl.innerHTML;
              if (fontEl.face) span.style.fontFamily = fontEl.face;
              if (fontEl.color) span.style.color = fontEl.color;
              fontEl.parentNode?.replaceChild(span, fontEl);
              replaced = true;
            }
          });
          return replaced;
        } else if (style === 'fontFamily') {
          const styleValue = FONTFAMILYMAP[value as FontName];
          document.execCommand('fontName', false, styleValue);
          return true;
        }
        return true;
      },
      [isEditingText]
    );

    const enterEditMode = useCallback(() => {
      if (!isEditingText && isSelected) {
        setIsEditingText(true);
      }
    }, [isEditingText, isSelected]);

    useImperativeHandle(
      ref,
      () => ({
        applyStyleToSelection: (style, value) => applyStyleToCurrentSelection(style, value),
        enterEditMode,
      }),
      [applyStyleToCurrentSelection, enterEditMode]
    );

    useEffect(() => {
      const textDiv = textEditRef.current;
      if (textDiv && !isEditingText && textDiv.innerHTML !== bubble.text) {
        textDiv.innerHTML = bubble.text;
      }
    }, [isEditingText, bubble.text]);

    useEffect(() => {
      if (isSelected && isEditingText && textEditRef.current) {
        if (bubble.text === 'Votre texte ici') {
          textEditRef.current.innerHTML = '';
          textEditRef.current.focus();
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(textEditRef.current);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }
    }, [isSelected, isEditingText, bubble.text]);

    useEffect(() => {
      if (!interaction) return;

      const handleMouseMove = (e: MouseEvent | TouchEvent) => {
        const isTouchEvent = 'touches' in e;
        const clientX = isTouchEvent ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
        const clientY = isTouchEvent ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;

        const deltaX = clientX - interaction.startX;
        const deltaY = clientY - interaction.startY;

        let newBubble = { ...bubble };

        if (interaction.mode === 'move') {
          newBubble.x = interaction.initialBubbleX + deltaX;
          newBubble.y = interaction.initialBubbleY + deltaY;
        } else if (interaction.mode === 'resize') {
          let dw = 0, dh = 0;
          if (interaction.activeHandle?.includes('l')) dw = -deltaX;
          if (interaction.activeHandle?.includes('r')) dw = deltaX;
          if (interaction.activeHandle?.includes('t')) dh = -deltaY;
          if (interaction.activeHandle?.includes('b')) dh = deltaY;

          newBubble.width = Math.max(MIN_BUBBLE_WIDTH, interaction.initialBubbleWidth + dw);
          newBubble.height = Math.max(MIN_BUBBLE_HEIGHT, interaction.initialBubbleHeight + dh);

          if (interaction.activeHandle?.includes('l')) newBubble.x = interaction.initialBubbleX + deltaX;
          if (interaction.activeHandle?.includes('t')) newBubble.y = interaction.initialBubbleY + deltaY;
        }

        onUpdate(newBubble);
      };

      const handleMouseUp = () => {
        setInteraction(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('touchmove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchend', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('touchmove', handleMouseMove, { passive: true });
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchend', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('touchmove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchend', handleMouseUp);
      };
    }, [interaction, bubble, onUpdate]);

    const { bodyPath, partsCircles } = useMemo(() => generateBubblePaths(bubble), [bubble]);
    const bbox = useMemo(() => getOverallBbox(bubble), [bubble]);

    const bubbleStyle: React.CSSProperties = {
      position: 'absolute',
      left: `${bubble.x}px`,
      top: `${bubble.y}px`,
      width: `${bubble.width}px`,
      height: `${bubble.height}px`,
      zIndex: bubble.zIndex,
      fontFamily: FONTFAMILYMAP[bubble.fontFamily],
      fontSize: `${bubble.fontSize}px`,
      color: bubble.textColor,
      border: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
      boxSizing: 'content-box',
    };

    const textContainerStyle: React.CSSProperties = {
      position: 'absolute',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',
      pointerEvents: 'auto',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      padding: '10px',
      cursor: isEditingText ? 'text' : 'move',
      textAlign: 'center',
    };

    const textEditStyle: React.CSSProperties = {
      outline: 'none',
      cursor: isEditingText ? 'text' : 'move',
      width: '100%',
      lineHeight: `calc(1em + ${Math.max(0, bubble.fontSize - 15)}px)`,
      wordWrap: 'break-word',
      overflowWrap: 'break-word',
    };

    const handleTextBlur = () => {
      setIsEditingText(false);
      const currentHTML = textEditRef.current?.innerHTML ?? '';
      if (currentHTML !== bubble.text) {
        onUpdate({
          ...bubble,
          text: currentHTML.trim() !== '' && currentHTML !== '<br>' ? currentHTML : 'Votre texte ici',
        });
      }
    };

    const handleBubbleBodyDoubleClick = useCallback(
      (e: React.MouseEvent) => {
        if (isSaving) return;
        e.preventDefault();
        e.stopPropagation();
        onDelete(bubble.id);
      },
      [isSaving, onDelete, bubble.id]
    );

    return (
      <div
        className="bubble-item-component"
        style={bubbleStyle}
        data-bubble-id={bubble.id}
        onDoubleClick={handleBubbleBodyDoubleClick}
      >
        <svg
          style={{
            position: 'absolute',
            pointerEvents: 'auto',
            left: `${bbox.x}px`,
            top: `${bbox.y}px`,
            width: `${bbox.width}px`,
            height: `${bbox.height}px`,
          }}
        >
          <path
            d={bodyPath}
            fill="white"
            stroke={bubble.borderColor}
            strokeWidth={BUBBLE_BORDER_WIDTH}
            strokeLinejoin="round"
            strokeLinecap="round"
            transform={`translate(${-bbox.x}, ${-bbox.y})`}
          />
        </svg>
        <div style={textContainerStyle}>
          <div
            ref={textEditRef}
            contentEditable={isEditingText}
            suppressContentEditableWarning
            onBlur={handleTextBlur}
            className="bubble-text"
            style={textEditStyle}
          />
        </div>
      </div>
    );
  }
);

BubbleItem.displayName = 'BubbleItem';
