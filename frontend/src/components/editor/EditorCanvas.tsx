import React, { useEffect, useCallback } from 'react';
import { Stage, Layer, Line, Rect, Circle, Text, Group } from 'react-konva';
import Konva from 'konva';
import { useEditorState, type ToolType, pxToMeters } from '../../hooks/useEditorState';

interface Props {
  width: number;
  height: number;
  stageRef: React.RefObject<Konva.Stage>;
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

    const nodeX = node.x();
    const nodeY = node.y();
    const nodeW = node.width();
    const nodeH = node.height();

    let closestRoomId: string | null = null;
    let maxIntersectionArea = 0;

    for (const el of elements) {
      if (el.type === 'room' && el.id !== id) {
        // Calculate intersection bounds
        const overlapX = Math.max(nodeX, el.x);
        const overlapY = Math.max(nodeY, el.y);
        const overlapW = Math.min(nodeX + nodeW, el.x + el.width) - overlapX;
        const overlapH = Math.min(nodeY + nodeH, el.y + el.height) - overlapY;

        if (overlapW > 0 && overlapH > 0) {
          const area = overlapW * overlapH;
          if (area > maxIntersectionArea) {
            maxIntersectionArea = area;
            closestRoomId = el.id;
          }
        }
      }
    }

    // Require a minimum intersection area to prevent accidental grazing swaps
    if (closestRoomId && maxIntersectionArea > 400) {
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
  const dragBoundFunc = useCallback((pos: Konva.Vector2d, nodeWidth: number, nodeHeight: number, id: string) => {
    let { x, y } = pos;
    const snapThreshold = 15; // magnetic radius

    for (const el of elements) {
      if (el.id === id) continue;
      if (el.type !== 'room' && el.type !== 'wall') continue;

      // Vertical snapping (X axis)
      if (Math.abs(x - (el.x + el.width)) < snapThreshold) x = el.x + el.width; // Snap left edge to right edge
      else if (Math.abs((x + nodeWidth) - el.x) < snapThreshold) x = el.x - nodeWidth; // Snap right edge to left edge
      else if (Math.abs(x - el.x) < snapThreshold) x = el.x; // Snap left to left

      // Horizontal snapping (Y axis)
      if (Math.abs(y - (el.y + el.height)) < snapThreshold) y = el.y + el.height; // Snap top edge to bottom edge
      else if (Math.abs((y + nodeHeight) - el.y) < snapThreshold) y = el.y - nodeHeight; // Snap bottom edge to top edge
      else if (Math.abs(y - el.y) < snapThreshold) y = el.y; // Snap top to top
    }
    return { x, y };
  }, [elements]);

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

      {/* Layer 2 — Elements */}
      <Layer>
        {elements.map((el) => {
          const isSelected = selectedId === el.id;

          if (el.type === 'room') {
            const { fill, stroke, labelColor } = getRoomColors(el.label ?? '', isSelected);
            return (
              <Group
                key={el.id}
                id={el.id}
                x={el.x}
                y={el.y}
                draggable={true}
                onDragStart={(e) => e.target.moveToTop()}
                dragBoundFunc={(pos) => dragBoundFunc(pos, el.width, el.height, el.id)}
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
                  cornerRadius={6}
                  shadowEnabled={true}
                  shadowColor="rgba(15,23,42,0.06)"
                  shadowBlur={isSelected ? 20 : 8}
                  shadowOffsetY={isSelected ? 2 : 1}
                />

                {/* Room label + area */}
                <Group x={0} y={el.height / 2 - 14} listening={false}>
                  <Text
                    text={el.label ?? 'Cameră'}
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
          }

          if (el.type === 'wall') {
            return (
              <Rect
                key={el.id}
                id={el.id}
                x={el.x}
                y={el.y}
                width={el.width}
                height={el.height}
                fill={OPENING_COLORS.wall.fill}
                stroke={OPENING_COLORS.wall.stroke}
                strokeWidth={1}
                listening={false}
              />
            );
          }

          if (el.type === 'door') {
            const isVertical = el.width < el.height;
            const colors = OPENING_COLORS.door;
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
                {/* Swing arc */}
                <Line
                  points={
                    isVertical
                      ? [0, 0, el.height, el.height, el.height, 0]
                      : [0, el.height, el.width, el.height, el.width, 0]
                  }
                  stroke={colors.stroke}
                  strokeWidth={1}
                  dash={[3, 3]}
                />
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
                {/* Window pane dividers */}
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
