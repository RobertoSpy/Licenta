import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Stage, Layer, Line, Rect, Text, Group, Transformer } from 'react-konva';
import Konva from 'konva';
import { useEditorState, CanvasElement, ToolType, GRID_SIZE_PX, metersToPx } from '../../hooks/useEditorState';

interface Props {
  width: number;
  height: number;
  stageRef: React.RefObject<Konva.Stage>;
  onRoomLabelRequest: (id: string, x: number, y: number) => void;
}

// Snap la grid
const snapToGrid = (value: number, gridSize: number) =>
  Math.round(value / gridSize) * gridSize;

// Snap la element vecin
const snapToElements = (
  value: number,
  axis: 'x' | 'y',
  elements: CanvasElement[],
  currentId: string,
  threshold = 15
): number => {
  for (const el of elements) {
    if (el.id === currentId) continue;
    const candidates = axis === 'x'
      ? [el.x, el.x + el.width]
      : [el.y, el.y + el.height];
    for (const c of candidates) {
      if (Math.abs(value - c) < threshold) return c;
    }
  }
  return value;
};

// Generare culori stabile per tip
const ELEMENT_COLORS: Record<ToolType, { fill: string; stroke: string }> = {
  room:      { fill: '#eff6ff', stroke: '#3b82f6' },
  wall:      { fill: '#1e293b', stroke: '#0f172a' },
  door:      { fill: '#fef3c7', stroke: '#f59e0b' },
  window:    { fill: '#e0f2fe', stroke: '#0ea5e9' },
  staircase: { fill: '#faf5ff', stroke: '#8b5cf6' },
  select:    { fill: 'transparent', stroke: 'transparent' },
};

export const EditorCanvas: React.FC<Props> = ({ width, height, stageRef, onRoomLabelRequest }) => {
  const {
    elements, selectedId, activeTool, canvasScale, canvasOffset,
    isSnapEnabled, showGrid, gridSize,
    addElement, updateElement, selectElement, setOffset, setZoom,
  } = useEditorState();

  const transformerRef = useRef<Konva.Transformer>(null);
  const isDrawing = useRef(false);
  const drawStart = useRef({ x: 0, y: 0 });
  const [drawingRect, setDrawingRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const isPanning = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });

  // Actualizare Transformer la schimbarea elementului selectat
  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const stage = stageRef.current;
    if (!stage) return;
    const selectedNode = selectedId ? stage.findOne(`#${selectedId}`) : null;
    transformer.nodes(selectedNode ? [selectedNode] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedId, stageRef]);

  // ─── Grid rendering ───────────────────────────────────────
  const renderGrid = () => {
    if (!showGrid) return null;
    const lines: React.ReactElement[] = [];
    const cols = Math.ceil(width / gridSize) + 1;
    const rows = Math.ceil(height / gridSize) + 1;

    for (let i = 0; i <= cols; i++) {
      const x = i * gridSize;
      const isMajor = i % 5 === 0;
      lines.push(
        <Line
          key={`v-${i}`}
          points={[x, 0, x, height]}
          stroke={isMajor ? '#cbd5e1' : '#f1f5f9'}
          strokeWidth={isMajor ? 0.8 : 0.4}
          listening={false}
        />
      );
    }
    for (let j = 0; j <= rows; j++) {
      const y = j * gridSize;
      const isMajor = j % 5 === 0;
      lines.push(
        <Line
          key={`h-${j}`}
          points={[0, y, width, y]}
          stroke={isMajor ? '#cbd5e1' : '#f1f5f9'}
          strokeWidth={isMajor ? 0.8 : 0.4}
          listening={false}
        />
      );
    }
    return lines;
  };

  // ─── Drag handlers cu snap ────────────────────────────────
  const handleDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>, id: string) => {
    if (!isSnapEnabled) return;
    const node = e.target;
    let x = node.x();
    let y = node.y();
    x = snapToGrid(x, gridSize);
    y = snapToGrid(y, gridSize);
    x = snapToElements(x, 'x', elements, id);
    y = snapToElements(y, 'y', elements, id);
    node.x(x);
    node.y(y);
  }, [isSnapEnabled, gridSize, elements]);

  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>, id: string) => {
    updateElement(id, { x: e.target.x(), y: e.target.y() });
  }, [updateElement]);

  const handleTransformEnd = useCallback((e: Konva.KonvaEventObject<Event>, id: string) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    updateElement(id, {
      x: node.x(),
      y: node.y(),
      width: Math.max(metersToPx(1), node.width() * scaleX),
      height: Math.max(metersToPx(1), node.height() * scaleY),
    });
  }, [updateElement]);

  // ─── Drawing (Room tool) ──────────────────────────────────
  const getRelativePos = (stage: Konva.Stage) => {
    const pos = stage.getPointerPosition();
    if (!pos) return { x: 0, y: 0 };
    return {
      x: (pos.x - canvasOffset.x) / canvasScale,
      y: (pos.y - canvasOffset.y) / canvasScale,
    };
  };

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;

    // Middle-click sau Space+click → pan
    if (e.evt.button === 1 || (e.evt.button === 0 && e.evt.altKey)) {
      isPanning.current = true;
      lastPanPos.current = { x: e.evt.clientX, y: e.evt.clientY };
      stage.container().style.cursor = 'grabbing';
      return;
    }

    if (activeTool === 'room') {
      const pos = getRelativePos(stage);
      const snappedX = isSnapEnabled ? snapToGrid(pos.x, gridSize) : pos.x;
      const snappedY = isSnapEnabled ? snapToGrid(pos.y, gridSize) : pos.y;
      isDrawing.current = true;
      drawStart.current = { x: snappedX, y: snappedY };
      setDrawingRect({ x: snappedX, y: snappedY, w: 0, h: 0 });
      return;
    }

    // Click pe spațiu gol → deselect
    if (e.target === stage) {
      selectElement(null);
    }
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;

    if (isPanning.current) {
      const dx = e.evt.clientX - lastPanPos.current.x;
      const dy = e.evt.clientY - lastPanPos.current.y;
      setOffset({ x: canvasOffset.x + dx, y: canvasOffset.y + dy });
      lastPanPos.current = { x: e.evt.clientX, y: e.evt.clientY };
      return;
    }

    if (!isDrawing.current || activeTool !== 'room') return;
    const pos = getRelativePos(stage);
    const snappedX = isSnapEnabled ? snapToGrid(pos.x, gridSize) : pos.x;
    const snappedY = isSnapEnabled ? snapToGrid(pos.y, gridSize) : pos.y;
    setDrawingRect({
      x: Math.min(drawStart.current.x, snappedX),
      y: Math.min(drawStart.current.y, snappedY),
      w: Math.abs(snappedX - drawStart.current.x),
      h: Math.abs(snappedY - drawStart.current.y),
    });
  };

  const handleStageMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (stage && isPanning.current) {
      isPanning.current = false;
      stage.container().style.cursor = activeTool === 'select' ? 'default' : 'crosshair';
      return;
    }

    if (!isDrawing.current || !drawingRect) return;
    isDrawing.current = false;

    const minPx = metersToPx(1); // minim 1m × 1m
    if (drawingRect.w < minPx || drawingRect.h < minPx) {
      setDrawingRect(null);
      return;
    }

    const newElement = addElement({
      type: 'room',
      x: drawingRect.x,
      y: drawingRect.y,
      width: drawingRect.w,
      height: drawingRect.h,
      rotation: 0,
      label: 'Cameră',
      wallThicknessCm: 25,
    });

    setDrawingRect(null);

    // Cerem label-ul camerei prin dialog
    const stage2 = stageRef.current;
    if (stage2) {
      const stageBox = stage2.container().getBoundingClientRect();
      const cx = (drawingRect.x + drawingRect.w / 2) * canvasScale + canvasOffset.x + stageBox.left;
      const cy = (drawingRect.y + drawingRect.h / 2) * canvasScale + canvasOffset.y + stageBox.top;
      // Găsim ID-ul elementului nou adăugat
      setTimeout(() => {
        const state = useEditorState.getState();
        const last = state.elements[state.elements.length - 1];
        if (last) onRoomLabelRequest(last.id, cx, cy);
      }, 50);
    }
  };

  // ─── Wheel zoom ───────────────────────────────────────────
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const scaleBy = 1.08;
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = canvasScale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - canvasOffset.x) / oldScale,
      y: (pointer.y - canvasOffset.y) / oldScale,
    };
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clamped = Math.min(Math.max(newScale, 0.25), 3);

    setZoom(clamped);
    setOffset({
      x: pointer.x - mousePointTo.x * clamped,
      y: pointer.y - mousePointTo.y * clamped,
    });
  };

  // ─── Cursor per tool ─────────────────────────────────────
  useEffect(() => {
    const stage = stageRef.current;
    if (stage) {
      stage.container().style.cursor = activeTool === 'select' ? 'default' : 'crosshair';
    }
  }, [activeTool, stageRef]);

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      scaleX={canvasScale}
      scaleY={canvasScale}
      x={canvasOffset.x}
      y={canvasOffset.y}
      onMouseDown={handleStageMouseDown}
      onMouseMove={handleStageMouseMove}
      onMouseUp={handleStageMouseUp}
      onWheel={handleWheel}
      className="bg-slate-50"
    >
      {/* Layer 1 — Grid (în spate, niciodată nu interacționează) */}
      <Layer listening={false}>
        {renderGrid()}
      </Layer>

      {/* Layer 2 — Elemente */}
      <Layer>
        {elements.map((el) => {
          const colors = ELEMENT_COLORS[el.type] ?? ELEMENT_COLORS.room;
          const isSelected = selectedId === el.id;

          if (el.type === 'room') {
            return (
              <Group
                key={el.id}
                id={el.id}
                x={el.x}
                y={el.y}
                draggable={activeTool === 'select'}
                onDragMove={(e) => handleDragMove(e, el.id)}
                onDragEnd={(e) => handleDragEnd(e, el.id)}
                onTransformEnd={(e) => handleTransformEnd(e, el.id)}
                onClick={() => activeTool === 'select' && selectElement(el.id)}
              >
                <Rect
                  width={el.width}
                  height={el.height}
                  fill={isSelected ? '#dbeafe' : colors.fill}
                  stroke={isSelected ? '#f97316' : colors.stroke}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  cornerRadius={2}
                  shadowEnabled={isSelected}
                  shadowColor="rgba(249,115,22,0.3)"
                  shadowBlur={8}
                />
                {/* Label cameră */}
                <Text
                  text={el.label ?? 'Cameră'}
                  x={8}
                  y={el.height / 2 - 8}
                  width={el.width - 16}
                  fontSize={Math.max(10, Math.min(14, el.width / 8))}
                  fontStyle="bold"
                  fill="#1e40af"
                  align="center"
                  listening={false}
                />
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
                fill={colors.fill}
                stroke={isSelected ? '#f97316' : colors.stroke}
                strokeWidth={isSelected ? 2 : 1}
                draggable={activeTool === 'select'}
                onDragMove={(e) => handleDragMove(e, el.id)}
                onDragEnd={(e) => handleDragEnd(e, el.id)}
                onClick={() => activeTool === 'select' && selectElement(el.id)}
              />
            );
          }

          if (el.type === 'door') {
            return (
              <Group
                key={el.id}
                id={el.id}
                x={el.x}
                y={el.y}
                rotation={el.rotation}
                draggable={activeTool === 'select'}
                onDragMove={(e) => handleDragMove(e, el.id)}
                onDragEnd={(e) => handleDragEnd(e, el.id)}
                onClick={() => activeTool === 'select' && selectElement(el.id)}
              >
                <Rect width={el.width} height={el.height} fill={colors.fill} stroke={colors.stroke} strokeWidth={1.5} />
                {/* Arc ușă */}
                <Line
                  points={[0, el.height, el.width, el.height, el.width, 0]}
                  stroke={colors.stroke}
                  strokeWidth={1}
                  dash={[4, 4]}
                  listening={false}
                />
              </Group>
            );
          }

          if (el.type === 'window') {
            return (
              <Group
                key={el.id}
                id={el.id}
                x={el.x}
                y={el.y}
                draggable={activeTool === 'select'}
                onDragMove={(e) => handleDragMove(e, el.id)}
                onDragEnd={(e) => handleDragEnd(e, el.id)}
                onClick={() => activeTool === 'select' && selectElement(el.id)}
              >
                <Rect width={el.width} height={el.height} fill={colors.fill} stroke={colors.stroke} strokeWidth={1.5} />
                <Line points={[el.width / 3, 0, el.width / 3, el.height]} stroke={colors.stroke} strokeWidth={1} listening={false} />
                <Line points={[(el.width / 3) * 2, 0, (el.width / 3) * 2, el.height]} stroke={colors.stroke} strokeWidth={1} listening={false} />
              </Group>
            );
          }

          if (el.type === 'staircase') {
            const steps = 8;
            return (
              <Group
                key={el.id}
                id={el.id}
                x={el.x}
                y={el.y}
                draggable={activeTool === 'select'}
                onDragMove={(e) => handleDragMove(e, el.id)}
                onDragEnd={(e) => handleDragEnd(e, el.id)}
                onClick={() => activeTool === 'select' && selectElement(el.id)}
              >
                <Rect width={el.width} height={el.height} fill={colors.fill} stroke={colors.stroke} strokeWidth={1.5} />
                {Array.from({ length: steps }).map((_, i) => (
                  <Line
                    key={i}
                    points={[0, (el.height / steps) * i, el.width, (el.height / steps) * i]}
                    stroke="#8b5cf6"
                    strokeWidth={0.8}
                    listening={false}
                  />
                ))}
              </Group>
            );
          }

          return null;
        })}

        {/* Rectangle preview în timp ce desenezi */}
        {drawingRect && drawingRect.w > 0 && drawingRect.h > 0 && (
          <Rect
            x={drawingRect.x}
            y={drawingRect.y}
            width={drawingRect.w}
            height={drawingRect.h}
            fill="rgba(59,130,246,0.1)"
            stroke="#3b82f6"
            strokeWidth={1.5}
            dash={[6, 4]}
            listening={false}
          />
        )}

        {/* Transformer — handles de resize */}
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < metersToPx(0.5) || newBox.height < metersToPx(0.5)) return oldBox;
            return newBox;
          }}
          rotateEnabled={false}
          anchorStroke="#f97316"
          borderStroke="#f97316"
          anchorFill="white"
          anchorSize={8}
        />
      </Layer>
    </Stage>
  );
};
