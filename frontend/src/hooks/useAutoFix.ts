// frontend/src/hooks/useAutoFix.ts
import { useState } from 'react';
import { type CanvasElement } from './useEditorState';
import { type ConformityRuleIssue } from './useConformityCheck';
import { type ConfiguratorRoom, type ConfiguratorDimensions, calculateShapeArea } from '../utils/layoutPartitioner';

interface AutoFixProps {
  elements: CanvasElement[];
  activeRooms: ConfiguratorRoom[];
  violationIssues: ConformityRuleIssue[];
  warningIssues: ConformityRuleIssue[];
  dimensions: ConfiguratorDimensions;
  houseShape: string;
  updateElement: (id: string, changes: Partial<CanvasElement>) => void;
  updateRoomRatio: (id: string, ratioValue: number) => void;
  regenerateLayout: () => void;
  addManualOpening: (roomId: string, type: 'door' | 'window', side: 'top' | 'bottom' | 'left' | 'right') => void;
  deleteElement: (id: string) => void;
}

export function useAutoFix({
  elements,
  activeRooms,
  violationIssues,
  warningIssues,
  dimensions,
  houseShape,
  updateElement,
  updateRoomRatio,
  regenerateLayout,
  addManualOpening,
  deleteElement,
}: AutoFixProps) {
  const [previewModal, setPreviewModal] = useState<{ affectedRooms: string[], message: string, onConfirm: () => void, onCancel: () => void } | null>(null);

  const applyAutoFix = () => {
    let fixesCount = 0;
    
    // 1. Non-destructive Fixes (Windows)
    const windowFixes = warningIssues.filter(v => v.code === 'NP057_WINDOW_FLOOR_RATIO_LIVING' || v.code === 'NP057_WINDOW_FLOOR_RATIO_OTHER');
    
    for (const v of windowFixes) {
      const room = elements.find(e => e.id === v.targetId && e.type === 'room');
      if (!room) continue;

      // Find all windows touching this room
      const currentWindows = elements.filter(e => {
        if (e.type !== 'window') return false;
        return (
          e.x <= room.x + room.width + 100 &&
          e.x + e.width >= room.x - 100 &&
          e.y <= room.y + room.height + 100 &&
          e.y + e.height >= room.y - 100
        );
      });

      if (currentWindows.length > 0) {
        const requiredWindowArea = v.requiredValue * (room.width * room.height / 400); // 400px = 1sqm
        // We know standard height is 1.5m
        const requiredTotalWidthM = requiredWindowArea / 1.5;
        
        let currentTotalWidthPx = 0;
        currentWindows.forEach(w => {
          currentTotalWidthPx += Math.max(w.width, w.height);
        });

        // 20px = 1m
        const requiredTotalWidthPx = requiredTotalWidthM * 20 * 1.05; // +5% safety margin
        
        if (requiredTotalWidthPx > currentTotalWidthPx) {
          const scaleX = requiredTotalWidthPx / currentTotalWidthPx;
          currentWindows.forEach(w => {
            const isHorizontal = w.width > w.height;
            if (isHorizontal) {
              // Clamp to room wall width minus a small margin
              const maxW = Math.max(20, room.width - 20);
              const newW = Math.min(Math.round(w.width * scaleX), maxW);
              const diff = newW - w.width;
              updateElement(w.id, {
                width: newW,
                x: w.x - diff / 2
              });
            } else {
              // Clamp to room wall height minus a small margin
              const maxH = Math.max(20, room.height - 20);
              const newH = Math.min(Math.round(w.height * scaleX), maxH);
              const diff = newH - w.height;
              updateElement(w.id, {
                height: newH,
                y: w.y - diff / 2
              });
            }
          });
          fixesCount += currentWindows.length;
        }
      }
    }

    // 2. Fix TOO_MANY_DOORS
    const tooManyDoorsFixes = warningIssues.filter(v => v.code === 'TOO_MANY_DOORS');
    for (const v of tooManyDoorsFixes) {
      const room = elements.find(e => e.id === v.targetId && e.type === 'room');
      if (!room) continue;

      const currentDoors = elements.filter(e => {
        if (e.type !== 'door') return false;
        return (
          e.x <= room.x + room.width + 100 &&
          e.x + e.width >= room.x - 100 &&
          e.y <= room.y + room.height + 100 &&
          e.y + e.height >= room.y - 100
        );
      });

      if (currentDoors.length > 2) {
        for (let i = 2; i < currentDoors.length; i++) {
          deleteElement(currentDoors[i].id);
          fixesCount++;
        }
      }
    }

    // 3. Fix NO_WINDOW
    const noWindowFixes = warningIssues.filter(v => v.code === 'NO_WINDOW');
    for (const v of noWindowFixes) {
      const room = elements.find(e => e.id === v.targetId && e.type === 'room');
      if (!room) continue;

      // Ensure we add a window on an edge
      addManualOpening(room.id, 'window', 'top');
      fixesCount++;
    }

    // 2. Destructive Fixes (Rooms)
    // Minim area rules are coded like L114_LIVING_MIN, L114_KITCHEN_MIN, etc.
    const roomFixes = violationIssues.filter(v => v.targetType === 'room' && v.code.includes('_MIN'));
    
    if (roomFixes.length > 0) {
      const totalArea = calculateShapeArea(houseShape, dimensions);
      const sumOfWeights = activeRooms.reduce((sum, r) => sum + (r.ratioValue || 1), 0);
      
      const newRooms = activeRooms.map(room => {
        const violation = roomFixes.find(v => v.targetId === room.id);
        if (!violation) return room;
        
        // requiredValue is the minSqm
        const minWeight = (violation.requiredValue / totalArea) * sumOfWeights;
        return {
          ...room,
          ratioValue: Math.max(room.ratioValue || 1, minWeight * 1.1) // 10% buffer
        };
      });

      setPreviewModal({
        affectedRooms: roomFixes.map(v => {
          const r = activeRooms.find(ar => ar.id === v.targetId);
          return r?.label || 'Cameră';
        }),
        message: 'Planul va fi redesenat (Treemap) pentru a garanta suprafețele minime legale.',
        onConfirm: () => {
          newRooms.forEach(nr => {
            const original = activeRooms.find(r => r.id === nr.id);
            if (original && original.ratioValue !== nr.ratioValue) {
              updateRoomRatio(nr.id, nr.ratioValue);
            }
          });
          regenerateLayout();
          setPreviewModal(null);
          // Optional: toast success
        },
        onCancel: () => setPreviewModal(null)
      });
    } else if (fixesCount > 0) {
      // Optional: toast `Au fost aplicate ${fixesCount} fix-uri.`
    }
  };

  return { applyAutoFix, previewModal, setPreviewModal };
}
