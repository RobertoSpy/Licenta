import React, { useEffect, useCallback } from 'react';
import { Stage, Layer, Line, Rect, Circle, Text, Group } from 'react-konva';
import Konva from 'konva';
import { useEditorState, type ToolType, pxToMeters } from '../../hooks/useEditorState';

interface Props {
  width: number;
  height: number;
  stageRef: React.RefObject<Konva.Stage | null>;
  onRoomLabelRequest: (id: string, x: number, y: number) => void;
}

// ── Premium color palette per room type ─────────────────────────────
function getRoomColors(label: string, isSelected: boolean): { fill: string; stroke: string; labelColor: string } {
  if (isSelected) return { fill: '#eff6ff', stroke: '#ef4444', labelColor: '#1e293b' };

  const n = (label ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');

  // Night zone — bedrooms
  if (n.includes('dormitor') || n.includes('camera')) {
    return { fill: '#f0fdf4', stroke: '#86efac', labelColor: '#166534' };
  }
  // Day zone — living spaces
  if (n.includes('living') || n.includes('sufragerie')) {
    return { fill: '#fff7ed', stroke: '#fdba74', labelColor: '#9a3412' };
  }
  // Kitchen / dining
  if (n.includes('bucatarie') || n.includes('dining') || n.includes('camara')) {
    return { fill: '#fefce8', stroke: '#fde047', labelColor: '#713f12' };
  }
  // Wet rooms
  if (n.includes('baie') || n.includes('wc') || n.includes('toaleta') || n.includes('dus')) {
    return { fill: '#eff6ff', stroke: '#93c5fd', labelColor: '#1e40af' };
  }
  // Hall / corridor
  if (n.includes('hol') || n.includes('antreu') || n.includes('coridor') || n.includes('vestibul')) {
    return { fill: '#f8fafc', stroke: '#cbd5e1', labelColor: '#475569' };
  }
  // Default
  return { fill: '#fafafa', stroke: '#d1d5db', labelColor: '#374151' };
}

// Opening colors
const OPENING_COLORS: Record<string, { fill: string; stroke: string }> = {
  door:      { fill: '#fef3c7', stroke: '#d97706' },
  window:    { fill: '#e0f2fe', stroke: '#0284c7' },
  wall:      { fill: '#334155', stroke: '#1e293b' },
  staircase: { fill: '#faf5ff', stroke: '#7c3aed' },
  select:    { fill: 'transparent', stroke: 'transparent' },
  room:      { fill: '#fafafa', stroke: '#d1d5db' },
  terasa:    { fill: '#ecfccb', stroke: '#84cc16' },
} satisfies Record<ToolType, { fill: string; stroke: string }>;

export const EditorCanvas: React.FC<Props> = ({ width, height, stageRef }) => {
  const {
    elements, selectedId, activeTool, canvasScale, canvasOffset,
    showGrid, gridSize, dimensions, houseShape,
    selectElement, setOffset, setZoom, swapRooms
  } = useEditorState();

  // ── Auto-fit: center the house footprint every time shape/size changes ──
  useEffect(() => {
    if (width <= 0 || height <= 0) return;

    const marginM = 3; // generous padding in meters
    const footprintWidthPx  = (dimensions.widthM  + marginM * 2) * 20;
    const footprintHeightPx = (dimensions.heightM + marginM * 2) * 20;

    const scale = Math.min(width / footprintWidthPx, height / footprintHeightPx);
    const finalScale = Math.min(Math.max(scale, 0.4), 2.5);

    const contentWidth  = footprintWidthPx  * finalScale;
    const contentHeight = footprintHeightPx * finalScale;

    setZoom(finalScale);
    setOffset({
      x: (width  - contentWidth)  / 2,
      y: (height - contentHeight) / 2,
    });
  }, [width, height, dimensions.widthM, dimensions.heightM, houseShape, setZoom, setOffset]);

  // ── Reset cursor on tool change ──────────────────────────────────────
  useEffect(() => {
    const stage = stageRef.current;
    if (stage) stage.container().style.cursor = 'default';
  }, [activeTool, stageRef]);

  // ── Premium dot-grid background ──────────────────────────────────────
  const renderBackground = () => {
    if (!showGrid) return null;
    const dots: React.ReactElement[] = [];
    // Only major dots (every 5 cells = 5m)
    const majorStep = gridSize * 5;
    const cols = Math.ceil(width / majorStep) + 2;
    const rows = Math.ceil(height / majorStep) + 2;

    for (let i = 0; i <= cols; i++) {
      for (let j = 0; j <= rows; j++) {
        dots.push(
          <Circle
            key={`d-${i}-${j}`}
            x={i * majorStep}
            y={j * majorStep}
            radius={1}
            fill="#d1d5db"
            listening={false}
          />
        );
      }
    }
    // Minor dots (every cell = 1m)
    for (let i = 0; i <= Math.ceil(width / gridSize) + 2; i++) {
      for (let j = 0; j <= Math.ceil(height / gridSize) + 2; j++) {
        if (i % 5 === 0 && j % 5 === 0) continue; // already drawn as major
        dots.push(
          <Circle
            key={`dm-${i}-${j}`}
            x={i * gridSize}
            y={j * gridSize}
            radius={0.5}
            fill="#e5e7eb"
            listening={false}
          />
        );
      }
    }
    return dots;
  };

  // ── Drag-to-swap with intersection logic & forced snap-back ───────────────
  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>, id: string) => {
    const node = e.target;

    const originalEl = elements.find(el => el.id === id);
    if (!originalEl) return;

    const nodeX = node.x();
    const nodeY = node.y();
    const nodeW = originalEl.width;
    const nodeH = originalEl.height;

    let closestRoomId: string | null = null;
    let maxOverlapRatio = 0;

    for (const el of elements) {
      if ((el.type === 'room' || el.type === 'terasa') && el.id !== id) {
        // Calculate intersection bounds
        const overlapX = Math.max(nodeX, el.x);
        const overlapY = Math.max(nodeY, el.y);
        const overlapW = Math.min(nodeX + nodeW, el.x + el.width) - overlapX;
        const overlapH = Math.min(nodeY + nodeH, el.y + el.height) - overlapY;

        if (overlapW > 0 && overlapH > 0) {
          const area = overlapW * overlapH;
          // Use ratio of overlap to smaller room — scale-independent
          const smallerArea = Math.min(nodeW * nodeH, el.width * el.height);
          const ratio = smallerArea > 0 ? area / smallerArea : 0;
          if (ratio > maxOverlapRatio) {
            maxOverlapRatio = ratio;
            closestRoomId = el.id;
          }
        }
      }
    }

    // Require at least 10% overlap of the smaller room to trigger swap
    if (closestRoomId && maxOverlapRatio > 0.1) {
      swapRooms(id, closestRoomId);
    } else {
      // ── Snap back: restore original position AND force Konva redraw ──
      const original = elements.find(el => el.id === id);
      if (original) {
        node.x(original.x);
        node.y(original.y);
        node.getLayer()?.batchDraw(); // Force immediate visual update
      }
    }
  }, [elements, swapRooms]);

  // ── Magnetic Snapping during drag ────────────────────────────────────


  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      scaleX={canvasScale}
      scaleY={canvasScale}
      x={canvasOffset.x}
      y={canvasOffset.y}
      style={{ background: '#f8fafc' }}
    >
      {/* Layer 1 — Premium dot background */}
      <Layer listening={false}>
        {renderBackground()}
      </Layer>

      {/* Layer 2 — Rooms and Terraces (Bottom) */}
      <Layer>
        {elements
          .filter((el) => el.type === 'room' || el.type === 'terasa')
          .map((el) => {
            const isSelected = selectedId === el.id;
            const isTerasa = el.type === 'terasa';
            let fill, stroke, labelColor;

            if (isTerasa) {
              fill = isSelected ? '#d9f99d' : '#ecfccb';
              stroke = isSelected ? '#ef4444' : '#84cc16';
              labelColor = '#3f6212';
            } else {
              const colors = getRoomColors(el.label ?? '', isSelected);
              fill = colors.fill;
              stroke = colors.stroke;
              labelColor = colors.labelColor;
            }

            return (
              <Group
                key={el.id}
                id={el.id}
                x={el.x}
                y={el.y}
                draggable={true}
                onDragStart={(e) => e.target.moveToTop()}
                onDragEnd={(e) => handleDragEnd(e, el.id)}
                onClick={() => selectElement(el.id)}
                onTap={() => selectElement(el.id)}
              >
                <Rect
                  width={el.width}
                  height={el.height}
                  fill={fill}
                  stroke={isSelected ? '#ef4444' : stroke}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  dash={isTerasa ? [6, 4] : undefined}
                  cornerRadius={isTerasa ? 0 : 6}
                  shadowEnabled={!isTerasa}
                  shadowColor="rgba(15,23,42,0.06)"
                  shadowBlur={isSelected ? 20 : 8}
                  shadowOffsetY={isSelected ? 2 : 1}
                />

                {/* Room label + area */}
                <Group x={0} y={el.height / 2 - 14} listening={false}>
                  {isTerasa && (
                    <Text
                      text="Terasă — nu se include în Sup. Utilă"
                      y={-14}
                      width={el.width}
                      fontSize={8}
                      fontFamily="Inter, system-ui, sans-serif"
                      fill={labelColor}
                      opacity={0.8}
                      align="center"
                    />
                  )}
                  <Text
                    text={el.label ?? (isTerasa ? 'Terasă' : 'Cameră')}
                    width={el.width}
                    fontSize={Math.max(10, Math.min(13, el.width / 9))}
                    fontStyle="bold"
                    fontFamily="Inter, system-ui, sans-serif"
                    fill={labelColor}
                    align="center"
                  />
                  <Text
                    text={`${parseFloat((pxToMeters(el.width) * pxToMeters(el.height)).toFixed(1))} m²`}
                    y={15}
                    width={el.width}
                    fontSize={Math.max(9, Math.min(11, el.width / 11))}
                    fontFamily="Inter, system-ui, sans-serif"
                    fill={labelColor}
                    opacity={0.65}
                    align="center"
                  />
                </Group>
              </Group>
            );
          })}
      </Layer>

      {/* Layer 3 — Walls and Openings (Top) */}
      <Layer>
        {elements
          .filter((el) => el.type !== 'room' && el.type !== 'terasa')
          .map((el) => {
            const isSelected = selectedId === el.id;

            if (el.type === 'wall') {
              const isVirtual = el.metadata?.isVirtualBoundary === true;
              return (
                <Rect
                  key={el.id}
                  id={el.id}
                  x={el.x}
                  y={el.y}
                  width={el.width}
                  height={el.height}
                  fill={isVirtual ? 'transparent' : OPENING_COLORS.wall.fill}
                  stroke={isSelected ? '#ef4444' : (isVirtual ? '#cbd5e1' : OPENING_COLORS.wall.stroke)}
                  strokeWidth={isSelected ? 2 : (isVirtual ? 1 : 1)}
                  dash={isVirtual ? [4, 4] : undefined}
                  listening={true}
                  onClick={() => selectElement(el.id)}
                  onTap={() => selectElement(el.id)}
                />
              );
            }

            if (el.type === 'door') {
              const isVertical = el.height > el.width;
              const colors = OPENING_COLORS.door;
              const doorLeafSizePx = Math.round(0.9 * 20);

              return (
                <Group
                  key={el.id}
                  id={el.id}
                  x={el.x}
                  y={el.y}
                  listening={true}
                  onClick={() => selectElement(el.id)}
                  onTap={() => selectElement(el.id)}
                >
                  <Rect
                    width={el.width}
                    height={el.height}
                    fill={isSelected ? '#fef08a' : colors.fill}
                    stroke={isSelected ? '#ef4444' : colors.stroke}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    cornerRadius={1}
                  />
                  {isVertical ? (
                    <>
                      <Rect
                        x={-doorLeafSizePx + el.width / 2}
                        y={0}
                        width={doorLeafSizePx}
                        height={el.height}
                        fill={isSelected ? '#fef9c3' : '#fffbeb'}
                        stroke={colors.stroke}
                        strokeWidth={1.5}
                        cornerRadius={1}
                      />
                      <Line
                        points={[el.width / 2, 0, el.width / 2 - doorLeafSizePx, el.height, el.width / 2, el.height]}
                        stroke={colors.stroke}
                        strokeWidth={1}
                        dash={[4, 3]}
                        opacity={0.6}
                      />
                    </>
                  ) : (
                    <>
                      <Rect
                        x={0}
                        y={-doorLeafSizePx + el.height / 2}
                        width={el.width}
                        height={doorLeafSizePx}
                        fill={isSelected ? '#fef9c3' : '#fffbeb'}
                        stroke={colors.stroke}
                        strokeWidth={1.5}
                        cornerRadius={1}
                      />
                      <Line
                        points={[0, el.height / 2, el.width, el.height / 2 - doorLeafSizePx, el.width, el.height / 2]}
                        stroke={colors.stroke}
                        strokeWidth={1}
                        dash={[4, 3]}
                        opacity={0.6}
                      />
                    </>
                  )}
                </Group>
              );
            }

            if (el.type === 'window') {
              const isVertical = el.width < el.height;
              const colors = OPENING_COLORS.window;
              return (
                <Group
                  key={el.id}
                  id={el.id}
                  x={el.x}
                  y={el.y}
                  listening={true}
                  onClick={() => selectElement(el.id)}
                  onTap={() => selectElement(el.id)}
                >
                  <Rect
                    width={el.width}
                    height={el.height}
                    fill={isSelected ? '#bae6fd' : colors.fill}
                    stroke={isSelected ? '#ef4444' : colors.stroke}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    cornerRadius={1}
                  />
                  {isVertical ? (
                    <>
                      <Line points={[0, el.height / 3, el.width, el.height / 3]} stroke={colors.stroke} strokeWidth={1} />
                      <Line points={[0, (el.height / 3) * 2, el.width, (el.height / 3) * 2]} stroke={colors.stroke} strokeWidth={1} />
                    </>
                  ) : (
                    <>
                      <Line points={[el.width / 3, 0, el.width / 3, el.height]} stroke={colors.stroke} strokeWidth={1} />
                      <Line points={[(el.width / 3) * 2, 0, (el.width / 3) * 2, el.height]} stroke={colors.stroke} strokeWidth={1} />
                    </>
                  )}
                </Group>
              );
            }

            return null;
          })}
      </Layer>
    </Stage>
  );
};
