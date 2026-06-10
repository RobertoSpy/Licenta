"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ARCHITECTURAL_STANDARDS = void 0;
exports.calculateShapeArea = calculateShapeArea;
exports.generateConfiguratorLayout = generateConfiguratorLayout;
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
const zoneBasedTreemap_1 = require("./zoneBasedTreemap");
const PIXELS_PER_METER = 20;
exports.ARCHITECTURAL_STANDARDS = {
    DOOR: {
        RESIDENTIAL_INTERIOR: 0.8, // metri (Standard Legea 114)
        RESIDENTIAL_EXTERIOR: 0.9, // metri (Ușă intrare standard)
        COMMERCIAL_MINIMUM: 0.9, // metri (Standard evacuare P118-99)
        BATHROOM: 0.7, // metri (Standard uzual)
    },
    WINDOW: {
        STANDARD_WIDTH: 1.2, // metri
    },
    WALL: {
        EXTERIOR_THICKNESS: 0.25, // metri
        INTERIOR_THICKNESS: 0.125, // metri
    }
};
function calculateShapeArea(shape, dims) {
    var _a, _b;
    const w = dims.widthM;
    const h = dims.heightM;
    const ww = (_a = dims.wingWidthM) !== null && _a !== void 0 ? _a : 4;
    const wl = (_b = dims.wingLengthM) !== null && _b !== void 0 ? _b : 4;
    if (shape === 'rectangle') {
        return w * h;
    }
    else if (shape === 'l_shape') {
        const w1 = Math.min(ww, w - 2);
        const h2 = Math.min(wl, h - 2);
        return w1 * h + (w - w1) * h2;
    }
    else if (shape === 'u_shape') {
        const w1 = Math.min(ww, w / 2.5);
        const h2 = Math.min(wl, h - 2);
        return 2 * w1 * h + (w - 2 * w1) * h2;
    }
    else if (shape === 't_shape') {
        const h1 = Math.min(wl, h / 2.2);
        const w2 = Math.min(ww, w - 2);
        return w * h1 + w2 * (h - h1);
    }
    return w * h;
}
/**
 * Normalizes Romanian characters and trims whitespace
 */
function normalizeLabel(label) {
    return label
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '');
}
function isDayRoom(r) {
    const z = (r.zone || '').toLowerCase();
    if (z.includes('zi') || z.includes('distributie'))
        return true;
    if (z.includes('noapte') || z.includes('tehnic'))
        return false;
    // fallback
    const norm = normalizeLabel(r.label);
    return (norm.includes('living') ||
        norm.includes('sufragerie') ||
        norm.includes('bucatarie') ||
        norm.includes('hol') ||
        norm.includes('antreu') ||
        norm.includes('vestibul') ||
        norm.includes('debara') ||
        norm.includes('camara') ||
        norm.includes('dining'));
}
// --- Squarified Treemap Algorithm ---
// Treemap and zone-based treemap implementations have been moved to `./layout/treemap` and
// `./layout/zoneBasedTreemap` to make the algorithm modular and isomorphic-friendly.
/**
 * FIX — Problema 3: Zone-based treemap uses area-correct weights.
 * Groups rooms by Zone, runs Treemap on Zones, then Treemap on Rooms inside each Zone.
 */
// zoneBasedTreemap implementation moved to ./layout/zoneBasedTreemap
/**
 * Main function: partitions selected house shape footprint and returns list of canvas elements
 */
function generateConfiguratorLayout(shape, dimensions, rooms, streetOrientation = 'S') {
    var _a, _b;
    const elements = [];
    const offsetM = 2; // Offset from canvas edge in meters
    // Default values
    const { widthM, heightM } = dimensions;
    const wingWidthM = (_a = dimensions.wingWidthM) !== null && _a !== void 0 ? _a : 4;
    const wingLengthM = (_b = dimensions.wingLengthM) !== null && _b !== void 0 ? _b : 4;
    const wThickM = exports.ARCHITECTURAL_STANDARDS.WALL.EXTERIOR_THICKNESS; // outer wall
    const thickPx = Math.round(wThickM * PIXELS_PER_METER);
    // 1. Compute bounding boxes of the shape and list of outer walls
    const shapesBBoxes = [];
    const outerWallLines = [];
    if (shape === 'rectangle') {
        shapesBBoxes.push({
            x: offsetM,
            y: offsetM,
            w: widthM,
            h: heightM,
        });
        const xM = offsetM;
        const yM = offsetM;
        outerWallLines.push({ x1: xM, y1: yM, x2: xM + widthM, y2: yM }); // Top
        outerWallLines.push({ x1: xM, y1: yM + heightM, x2: xM + widthM, y2: yM + heightM }); // Bottom
        outerWallLines.push({ x1: xM, y1: yM, x2: xM, y2: yM + heightM }); // Left
        outerWallLines.push({ x1: xM + widthM, y1: yM, x2: xM + widthM, y2: yM + heightM }); // Right
    }
    else if (shape === 'l_shape') {
        const w1 = Math.min(wingWidthM, widthM - 2);
        const h2 = Math.min(wingLengthM, heightM - 2);
        const leftWing = { x: offsetM, y: offsetM, w: w1, h: heightM };
        const rightWing = { x: offsetM + w1, y: offsetM + heightM - h2, w: widthM - w1, h: h2 };
        shapesBBoxes.push(leftWing, rightWing);
        const xM = offsetM;
        const yM = offsetM;
        outerWallLines.push({ x1: xM, y1: yM, x2: xM + w1, y2: yM });
        outerWallLines.push({ x1: xM + w1, y1: yM, x2: xM + w1, y2: yM + heightM - h2 });
        outerWallLines.push({ x1: xM + w1, y1: yM + heightM - h2, x2: xM + widthM, y2: yM + heightM - h2 });
        outerWallLines.push({ x1: xM + widthM, y1: yM + heightM - h2, x2: xM + widthM, y2: yM + heightM });
        outerWallLines.push({ x1: xM, y1: yM + heightM, x2: xM + widthM, y2: yM + heightM });
        outerWallLines.push({ x1: xM, y1: yM, x2: xM, y2: yM + heightM });
    }
    else if (shape === 'u_shape') {
        const w1 = Math.min(wingWidthM, widthM / 2.5);
        const h2 = Math.min(wingLengthM, heightM - 2);
        const leftWing = { x: offsetM, y: offsetM, w: w1, h: heightM };
        const centerWing = { x: offsetM + w1, y: offsetM + heightM - h2, w: widthM - 2 * w1, h: h2 };
        const rightWing = { x: offsetM + widthM - w1, y: offsetM, w: w1, h: heightM };
        shapesBBoxes.push(leftWing, centerWing, rightWing);
        const xM = offsetM;
        const yM = offsetM;
        outerWallLines.push({ x1: xM, y1: yM, x2: xM + w1, y2: yM });
        outerWallLines.push({ x1: xM + w1, y1: yM, x2: xM + w1, y2: yM + heightM - h2 });
        outerWallLines.push({ x1: xM + w1, y1: yM + heightM - h2, x2: xM + widthM - w1, y2: yM + heightM - h2 });
        outerWallLines.push({ x1: xM + widthM - w1, y1: yM + heightM - h2, x2: xM + widthM - w1, y2: yM });
        outerWallLines.push({ x1: xM + widthM - w1, y1: yM, x2: xM + widthM, y2: yM });
        outerWallLines.push({ x1: xM + widthM, y1: yM, x2: xM + widthM, y2: yM + heightM });
        outerWallLines.push({ x1: xM, y1: yM + heightM, x2: xM + widthM, y2: yM + heightM });
        outerWallLines.push({ x1: xM, y1: yM, x2: xM, y2: yM + heightM });
    }
    else {
        // t_shape
        const h1 = Math.min(wingLengthM, heightM / 2.2);
        const w2 = Math.min(wingWidthM, widthM - 2);
        const stemX = offsetM + (widthM - w2) / 2;
        const topWing = { x: offsetM, y: offsetM, w: widthM, h: h1 };
        const stemWing = { x: stemX, y: offsetM + h1, w: w2, h: heightM - h1 };
        shapesBBoxes.push(topWing, stemWing);
        const xM = offsetM;
        const yM = offsetM;
        outerWallLines.push({ x1: xM, y1: yM, x2: xM + widthM, y2: yM });
        outerWallLines.push({ x1: xM + widthM, y1: yM, x2: xM + widthM, y2: yM + h1 });
        outerWallLines.push({ x1: stemX + w2, y1: yM + h1, x2: xM + widthM, y2: yM + h1 });
        outerWallLines.push({ x1: stemX + w2, y1: yM + h1, x2: stemX + w2, y2: yM + heightM });
        outerWallLines.push({ x1: stemX, y1: yM + heightM, x2: stemX + w2, y2: yM + heightM });
        outerWallLines.push({ x1: stemX, y1: yM + h1, x2: stemX, y2: yM + heightM });
        outerWallLines.push({ x1: xM, y1: yM + h1, x2: stemX, y2: yM + h1 });
        outerWallLines.push({ x1: xM, y1: yM, x2: xM, y2: yM + h1 });
    }
    // FIX — Problema 2: Separate terraces BEFORE zone processing so they are never
    // duplicated by zone splitting (one terrace per JSON entry, not one per zone).
    const indoorRooms = rooms.filter(r => !normalizeLabel(r.label).startsWith('terasa') && !r.label.toLowerCase().startsWith('teras'));
    const terraceRooms = rooms.filter(r => normalizeLabel(r.label).startsWith('terasa') || r.label.toLowerCase().startsWith('teras'));
    // 3. Distribute rooms to shape bounding boxes
    const partitionedRooms = [];
    if (shapesBBoxes.length === 1) {
        // Rectangle
        partitionedRooms.push(...(0, zoneBasedTreemap_1.zoneBasedTreemap)(shapesBBoxes[0], indoorRooms, streetOrientation));
    }
    else {
        // L, U, or T - multiple bounding boxes
        const dayRooms = indoorRooms.filter(r => isDayRoom(r));
        const nightRooms = indoorRooms.filter(r => !isDayRoom(r));
        if (shape === 'l_shape' || shape === 't_shape') {
            if (dayRooms.length > 0 && nightRooms.length > 0) {
                partitionedRooms.push(...(0, zoneBasedTreemap_1.zoneBasedTreemap)(shapesBBoxes[0], dayRooms, streetOrientation));
                partitionedRooms.push(...(0, zoneBasedTreemap_1.zoneBasedTreemap)(shapesBBoxes[1], nightRooms, streetOrientation));
            }
            else {
                const half = Math.ceil(indoorRooms.length / 2);
                partitionedRooms.push(...(0, zoneBasedTreemap_1.zoneBasedTreemap)(shapesBBoxes[0], indoorRooms.slice(0, half), streetOrientation));
                partitionedRooms.push(...(0, zoneBasedTreemap_1.zoneBasedTreemap)(shapesBBoxes[1], indoorRooms.slice(half), streetOrientation));
            }
        }
        else {
            // U-shape: 3 bounding boxes: 0 (left), 1 (center/bottom), 2 (right)
            if (dayRooms.length > 0) {
                partitionedRooms.push(...(0, zoneBasedTreemap_1.zoneBasedTreemap)(shapesBBoxes[1], dayRooms, streetOrientation));
                const half = Math.ceil(nightRooms.length / 2);
                const leftRooms = nightRooms.slice(0, half);
                const rightRooms = nightRooms.slice(half);
                if (leftRooms.length > 0)
                    partitionedRooms.push(...(0, zoneBasedTreemap_1.zoneBasedTreemap)(shapesBBoxes[0], leftRooms, streetOrientation));
                if (rightRooms.length > 0)
                    partitionedRooms.push(...(0, zoneBasedTreemap_1.zoneBasedTreemap)(shapesBBoxes[2], rightRooms, streetOrientation));
            }
            else {
                const third = Math.ceil(indoorRooms.length / 3);
                partitionedRooms.push(...(0, zoneBasedTreemap_1.zoneBasedTreemap)(shapesBBoxes[0], indoorRooms.slice(0, third), streetOrientation));
                partitionedRooms.push(...(0, zoneBasedTreemap_1.zoneBasedTreemap)(shapesBBoxes[1], indoorRooms.slice(third, 2 * third), streetOrientation));
                partitionedRooms.push(...(0, zoneBasedTreemap_1.zoneBasedTreemap)(shapesBBoxes[2], indoorRooms.slice(2 * third), streetOrientation));
            }
        }
    }
    // 3. Add Wall elements around the shape perimeter
    for (const line of outerWallLines) {
        const isHorizontal = Math.abs(line.y1 - line.y2) < 0.01;
        const x = Math.round(line.x1 * PIXELS_PER_METER);
        const y = Math.round(line.y1 * PIXELS_PER_METER);
        if (isHorizontal) {
            const width = Math.round(Math.abs(line.x2 - line.x1) * PIXELS_PER_METER);
            elements.push({
                id: uuidv4(),
                type: 'wall',
                x,
                y: y - thickPx / 2,
                width,
                height: thickPx,
                rotation: 0,
            });
        }
        else {
            const height = Math.round(Math.abs(line.y2 - line.y1) * PIXELS_PER_METER);
            elements.push({
                id: uuidv4(),
                type: 'wall',
                x: x - thickPx / 2,
                y,
                width: thickPx,
                height,
                rotation: 0,
            });
        }
    }
    // 4. Add Room elements
    for (const pr of partitionedRooms) {
        const rx = Math.round(pr.bbox.x * PIXELS_PER_METER);
        const ry = Math.round(pr.bbox.y * PIXELS_PER_METER);
        const rw = Math.round(pr.bbox.w * PIXELS_PER_METER);
        const rh = Math.round(pr.bbox.h * PIXELS_PER_METER);
        const isTerasa = pr.label.toLowerCase().startsWith('teras');
        elements.push({
            id: pr.id,
            type: isTerasa ? 'terasa' : 'room',
            label: pr.label,
            x: rx,
            y: ry,
            width: rw,
            height: rh,
            rotation: 0,
            wallThicknessCm: exports.ARCHITECTURAL_STANDARDS.WALL.EXTERIOR_THICKNESS * 100,
        });
        // 5. Generate automated Windows on exterior walls
        const roomDef = indoorRooms.find(ar => ar.id === pr.id);
        if (roomDef && roomDef.naturalLight) {
            const roomBBox = pr.bbox;
            // FIX - Problema 4: Am mărit thresholdM pentru L/U/T shapes din cauza floating point errors de la treemap
            const thresholdM = 0.15;
            const preferredOrientations = roomDef.orientation || [];
            // Calculate dynamic window width to satisfy conformity rules (NP057)
            const normLabel = normalizeLabel(pr.label);
            const isDayRoomConformity = ['living', 'sufragerie', 'cameradezi', 'dormitor', 'camera', 'cameraparintilor'].some(k => normLabel.includes(k));
            const requiredRatio = isDayRoomConformity ? 0.125 : 0.1;
            const targetWindowAreaSqm = roomBBox.w * roomBBox.h * requiredRatio;
            // Standard window height is 1.5m. We add 5% margin to ensure it passes.
            const requiredWinWidthM = Math.ceil(((targetWindowAreaSqm / 1.5) * 1.05) * 10) / 10;
            let windowPlaced = false;
            // Primary pass: Try matching preferred orientations
            for (const line of outerWallLines) {
                const isHorizontal = Math.abs(line.y1 - line.y2) < 0.01;
                let wallOrientation = '';
                if (isHorizontal) {
                    if (Math.abs(line.y1 - offsetM) < thresholdM)
                        wallOrientation = 'N'; // Top
                    else
                        wallOrientation = 'S'; // Bottom
                    const touchesWall = Math.abs(line.y1 - roomBBox.y) < thresholdM || Math.abs(line.y1 - (roomBBox.y + roomBBox.h)) < thresholdM;
                    if (touchesWall && roomBBox.x + roomBBox.w > line.x1 + thresholdM && roomBBox.x < line.x2 - thresholdM) {
                        if (preferredOrientations.length === 0 || preferredOrientations.some(o => wallOrientation.includes(o))) {
                            const maxWinWidthM = roomBBox.w - 0.4;
                            const finalWinWidthM = Math.min(Math.max(exports.ARCHITECTURAL_STANDARDS.WINDOW.STANDARD_WIDTH, requiredWinWidthM), Math.max(0.6, maxWinWidthM));
                            const winW = Math.round(finalWinWidthM * PIXELS_PER_METER);
                            elements.push({
                                id: uuidv4(),
                                type: 'window',
                                x: rx + rw / 2 - winW / 2,
                                y: Math.abs(line.y1 - roomBBox.y) < thresholdM ? ry - thickPx / 2 : ry + rh - thickPx / 2,
                                width: winW,
                                height: thickPx,
                                rotation: 0,
                            });
                            windowPlaced = true;
                            break;
                        }
                    }
                }
                else {
                    if (Math.abs(line.x1 - offsetM) < thresholdM)
                        wallOrientation = 'V'; // Left (Vest/West)
                    else
                        wallOrientation = 'E'; // Right (Est/East)
                    const touchesWall = Math.abs(line.x1 - roomBBox.x) < thresholdM || Math.abs(line.x1 - (roomBBox.x + roomBBox.w)) < thresholdM;
                    if (touchesWall && roomBBox.y + roomBBox.h > line.y1 + thresholdM && roomBBox.y < line.y2 - thresholdM) {
                        if (preferredOrientations.length === 0 || preferredOrientations.some(o => wallOrientation.includes(o) || (wallOrientation === 'V' && o === 'W'))) {
                            const maxWinWidthM = roomBBox.h - 0.4;
                            const finalWinWidthM = Math.min(Math.max(exports.ARCHITECTURAL_STANDARDS.WINDOW.STANDARD_WIDTH, requiredWinWidthM), Math.max(0.6, maxWinWidthM));
                            const winH = Math.round(finalWinWidthM * PIXELS_PER_METER);
                            elements.push({
                                id: uuidv4(),
                                type: 'window',
                                x: Math.abs(line.x1 - roomBBox.x) < thresholdM ? rx - thickPx / 2 : rx + rw - thickPx / 2,
                                y: ry + rh / 2 - winH / 2,
                                width: thickPx,
                                height: winH,
                                rotation: 0,
                            });
                            windowPlaced = true;
                            break;
                        }
                    }
                }
            }
            // Secondary pass: If no window was placed (e.g. orientation impossible), place it on ANY exterior wall it touches
            if (!windowPlaced) {
                for (const line of outerWallLines) {
                    const isHorizontal = Math.abs(line.y1 - line.y2) < 0.01;
                    if (isHorizontal) {
                        const touchesWall = Math.abs(line.y1 - roomBBox.y) < thresholdM || Math.abs(line.y1 - (roomBBox.y + roomBBox.h)) < thresholdM;
                        if (touchesWall && roomBBox.x + roomBBox.w > line.x1 + thresholdM && roomBBox.x < line.x2 - thresholdM) {
                            const maxWinWidthM = roomBBox.w - 0.4;
                            const finalWinWidthM = Math.min(Math.max(exports.ARCHITECTURAL_STANDARDS.WINDOW.STANDARD_WIDTH, requiredWinWidthM), Math.max(0.6, maxWinWidthM));
                            const winW = Math.round(finalWinWidthM * PIXELS_PER_METER);
                            elements.push({
                                id: uuidv4(),
                                type: 'window',
                                x: rx + rw / 2 - winW / 2,
                                y: Math.abs(line.y1 - roomBBox.y) < thresholdM ? ry - thickPx / 2 : ry + rh - thickPx / 2,
                                width: winW, height: thickPx, rotation: 0
                            });
                            break;
                        }
                    }
                    else {
                        const touchesWall = Math.abs(line.x1 - roomBBox.x) < thresholdM || Math.abs(line.x1 - (roomBBox.x + roomBBox.w)) < thresholdM;
                        if (touchesWall && roomBBox.y + roomBBox.h > line.y1 + thresholdM && roomBBox.y < line.y2 - thresholdM) {
                            const maxWinWidthM = roomBBox.h - 0.4;
                            const finalWinWidthM = Math.min(Math.max(exports.ARCHITECTURAL_STANDARDS.WINDOW.STANDARD_WIDTH, requiredWinWidthM), Math.max(0.6, maxWinWidthM));
                            const winH = Math.round(finalWinWidthM * PIXELS_PER_METER);
                            elements.push({
                                id: uuidv4(),
                                type: 'window',
                                x: Math.abs(line.x1 - roomBBox.x) < thresholdM ? rx - thickPx / 2 : rx + rw - thickPx / 2,
                                y: ry + rh / 2 - winH / 2,
                                width: thickPx, height: winH, rotation: 0
                            });
                            break;
                        }
                    }
                }
            }
        }
    }
    // 5.5. FIX — Problema 2: Add Terrace elements as single units OUTSIDE the house bounding box.
    // Each entry in terraceRooms → one terrace, centered at the bottom of the house.
    let terraceOffset = offsetM + heightM; // start at bottom edge of house
    for (const tr of terraceRooms) {
        const area = tr.minSqm && tr.maxSqm
            ? (tr.minSqm + tr.maxSqm) / 2
            : (tr.minSqm || tr.maxSqm || 15);
        const tw = Math.min(widthM * 0.6, 8); // max 8m width or 60% of house
        const th = area / tw;
        const tx = offsetM + (widthM / 2) - (tw / 2); // centered at bottom
        elements.push({
            id: tr.id,
            type: 'terasa',
            label: tr.label,
            x: Math.round(tx * PIXELS_PER_METER),
            y: Math.round(terraceOffset * PIXELS_PER_METER),
            width: Math.round(tw * PIXELS_PER_METER),
            height: Math.round(th * PIXELS_PER_METER),
            rotation: 0,
            wallThicknessCm: 0, // no walls for terrace
        });
        terraceOffset += th;
    }
    // 6. FIX — Problema 3: Automatically generate internal Doors cu toleranță redusă.
    // Valoarea corectă: Grosimea peretelui interior + un mic epsilon pentru erori de rotunjire
    const GAP_TOLERANCE = exports.ARCHITECTURAL_STANDARDS.WALL.INTERIOR_THICKNESS + 0.05; // ~0.175m
    // Reduced minimum overlap from 1.0m to 0.6m.
    const MIN_OVERLAP = 0.6; // meters - minimum shared wall length for a door
    const doorSizePx = Math.round(exports.ARCHITECTURAL_STANDARDS.DOOR.RESIDENTIAL_INTERIOR * PIXELS_PER_METER);
    const createdDoors = new Set();
    // Helper pt limita usi
    const doorCounts = {};
    for (const pr of partitionedRooms) {
        doorCounts[pr.id] = 0;
    }
    function canAddDoor(roomId) {
        const roomDef = indoorRooms.find(ar => ar.id === roomId);
        if ((roomDef === null || roomDef === void 0 ? void 0 : roomDef.isCirculation) || (roomDef === null || roomDef === void 0 ? void 0 : roomDef.zone) === 'distributie')
            return true;
        return (doorCounts[roomId] || 0) < 2;
    }
    function incrementDoor(r1, r2) {
        if (doorCounts[r1] !== undefined)
            doorCounts[r1]++;
        if (doorCounts[r2] !== undefined)
            doorCounts[r2]++;
    }
    for (const room of indoorRooms) {
        if (!room.hasDoorTo || room.hasDoorTo.length === 0)
            continue;
        const roomP = partitionedRooms.find(r => r.id === room.id);
        if (!roomP)
            continue;
        for (const targetLabel of room.hasDoorTo) {
            const targetRoom = partitionedRooms.find(r => {
                const a = normalizeLabel(r.label);
                const b = normalizeLabel(targetLabel);
                // Match parțial în ambele direcții
                return a.includes(b) || b.includes(a) ||
                    // Match pe primele 5 caractere ca fallback (e.g. "hol int..." === "hol p...")
                    a.split('').slice(0, 5).join('') === b.split('').slice(0, 5).join('');
            });
            if (!targetRoom)
                continue;
            const pairId = [roomP.id, targetRoom.id].sort().join('-');
            if (createdDoors.has(pairId))
                continue;
            // Limitare numar usi la 2 pt camere locuibile
            if (!canAddDoor(roomP.id) || !canAddDoor(targetRoom.id))
                continue;
            // Try vertical shared wall (rooms side-by-side)
            const xDiff = Math.abs(roomP.bbox.x + roomP.bbox.w - targetRoom.bbox.x);
            const xDiffReverse = Math.abs(targetRoom.bbox.x + targetRoom.bbox.w - roomP.bbox.x);
            const overlapY = Math.min(roomP.bbox.y + roomP.bbox.h, targetRoom.bbox.y + targetRoom.bbox.h) -
                Math.max(roomP.bbox.y, targetRoom.bbox.y);
            if ((xDiff < GAP_TOLERANCE || xDiffReverse < GAP_TOLERANCE) && overlapY >= MIN_OVERLAP) {
                const boundaryX = xDiff < xDiffReverse ? roomP.bbox.x + roomP.bbox.w : roomP.bbox.x;
                const startY = Math.max(roomP.bbox.y, targetRoom.bbox.y) + overlapY / 2 - 0.4;
                elements.push({
                    id: uuidv4(),
                    type: 'door',
                    x: Math.round(boundaryX * PIXELS_PER_METER) - thickPx / 2,
                    y: Math.round(startY * PIXELS_PER_METER),
                    width: thickPx,
                    height: doorSizePx,
                    rotation: 0,
                });
                createdDoors.add(pairId);
                incrementDoor(roomP.id, targetRoom.id);
                continue;
            }
            // Try horizontal shared wall (rooms stacked top/bottom)
            const yDiff = Math.abs(roomP.bbox.y + roomP.bbox.h - targetRoom.bbox.y);
            const yDiffReverse = Math.abs(targetRoom.bbox.y + targetRoom.bbox.h - roomP.bbox.y);
            const overlapX = Math.min(roomP.bbox.x + roomP.bbox.w, targetRoom.bbox.x + targetRoom.bbox.w) -
                Math.max(roomP.bbox.x, targetRoom.bbox.x);
            if ((yDiff < GAP_TOLERANCE || yDiffReverse < GAP_TOLERANCE) && overlapX >= MIN_OVERLAP) {
                const boundaryY = yDiff < yDiffReverse ? roomP.bbox.y + roomP.bbox.h : roomP.bbox.y;
                const startX = Math.max(roomP.bbox.x, targetRoom.bbox.x) + overlapX / 2 - 0.4;
                elements.push({
                    id: uuidv4(),
                    type: 'door',
                    x: Math.round(startX * PIXELS_PER_METER),
                    y: Math.round(boundaryY * PIXELS_PER_METER) - thickPx / 2,
                    width: doorSizePx,
                    height: thickPx,
                    rotation: 0,
                });
                createdDoors.add(pairId);
                incrementDoor(roomP.id, targetRoom.id);
            }
        }
    }
    // 6.5. FIX — Problema uși lipsă (Fallback geometric)
    // Dacă o cameră a rămas izolată (ex. are hasDoorTo spre ceva neadiacent, sau lipsesc intențiile),
    // o conectăm forțat de primul vecin geometric valid, prioritizând zonele de 'distributie' (Holuri).
    for (const room of indoorRooms) {
        const roomP = partitionedRooms.find(r => r.id === room.id);
        if (!roomP)
            continue;
        // Verificăm dacă a primit deja vreo ușă
        const hasAnyDoor = Array.from(createdDoors).some(pair => pair.includes(roomP.id));
        if (hasAnyDoor)
            continue;
        // Limitare
        if (!canAddDoor(roomP.id))
            continue;
        let bestNeighbor = null;
        let bestBoundary = null;
        for (const neighborP of partitionedRooms) {
            if (neighborP.id === roomP.id)
                continue;
            const neighborInfo = indoorRooms.find(r => r.id === neighborP.id);
            const xDiff = Math.abs(roomP.bbox.x + roomP.bbox.w - neighborP.bbox.x);
            const xDiffReverse = Math.abs(neighborP.bbox.x + neighborP.bbox.w - roomP.bbox.x);
            const overlapY = Math.min(roomP.bbox.y + roomP.bbox.h, neighborP.bbox.y + neighborP.bbox.h) - Math.max(roomP.bbox.y, neighborP.bbox.y);
            const yDiff = Math.abs(roomP.bbox.y + roomP.bbox.h - neighborP.bbox.y);
            const yDiffReverse = Math.abs(neighborP.bbox.y + neighborP.bbox.h - roomP.bbox.y);
            const overlapX = Math.min(roomP.bbox.x + roomP.bbox.w, neighborP.bbox.x + neighborP.bbox.w) - Math.max(roomP.bbox.x, neighborP.bbox.x);
            let boundary = null;
            if ((xDiff < GAP_TOLERANCE || xDiffReverse < GAP_TOLERANCE) && overlapY >= MIN_OVERLAP) {
                boundary = {
                    type: 'vertical',
                    x: xDiff < xDiffReverse ? roomP.bbox.x + roomP.bbox.w : roomP.bbox.x,
                    y: Math.max(roomP.bbox.y, neighborP.bbox.y) + overlapY / 2 - 0.4
                };
            }
            else if ((yDiff < GAP_TOLERANCE || yDiffReverse < GAP_TOLERANCE) && overlapX >= MIN_OVERLAP) {
                boundary = {
                    type: 'horizontal',
                    y: yDiff < yDiffReverse ? roomP.bbox.y + roomP.bbox.h : roomP.bbox.y,
                    x: Math.max(roomP.bbox.x, neighborP.bbox.x) + overlapX / 2 - 0.4
                };
            }
            if (boundary) {
                const isHol = (neighborInfo === null || neighborInfo === void 0 ? void 0 : neighborInfo.zone) === 'distributie';
                if (!bestNeighbor || isHol) {
                    bestNeighbor = neighborP;
                    bestBoundary = boundary;
                    if (isHol)
                        break; // Am găsit vecinul ideal
                }
            }
        }
        if (bestNeighbor && bestBoundary) {
            if (bestBoundary.type === 'vertical') {
                elements.push({
                    id: uuidv4(), type: 'door',
                    x: Math.round(bestBoundary.x * PIXELS_PER_METER) - thickPx / 2,
                    y: Math.round(bestBoundary.y * PIXELS_PER_METER),
                    width: thickPx, height: doorSizePx, rotation: 0
                });
            }
            else {
                elements.push({
                    id: uuidv4(), type: 'door',
                    x: Math.round(bestBoundary.x * PIXELS_PER_METER),
                    y: Math.round(bestBoundary.y * PIXELS_PER_METER) - thickPx / 2,
                    width: doorSizePx, height: thickPx, rotation: 0
                });
            }
            createdDoors.add([roomP.id, bestNeighbor.id].sort().join('-'));
            incrementDoor(roomP.id, bestNeighbor.id);
        }
    }
    // 7. Add main entrance door
    const halls = partitionedRooms.filter(pr => {
        const r = indoorRooms.find(ar => ar.id === pr.id);
        return r === null || r === void 0 ? void 0 : r.isCirculation;
    });
    if (halls.length > 0) {
        const mainHall = halls[0];
        const hx = Math.round(mainHall.bbox.x * PIXELS_PER_METER);
        const hy = Math.round(mainHall.bbox.y * PIXELS_PER_METER);
        const hw = Math.round(mainHall.bbox.w * PIXELS_PER_METER);
        const hh = Math.round(mainHall.bbox.h * PIXELS_PER_METER);
        const extDoorSizePx = Math.round(exports.ARCHITECTURAL_STANDARDS.DOOR.RESIDENTIAL_EXTERIOR * PIXELS_PER_METER);
        const touchesBottom = Math.abs(mainHall.bbox.y + mainHall.bbox.h - (offsetM + heightM)) < 0.05;
        const touchesTop = Math.abs(mainHall.bbox.y - offsetM) < 0.05;
        const touchesLeft = Math.abs(mainHall.bbox.x - offsetM) < 0.05;
        const touchesRight = Math.abs(mainHall.bbox.x + mainHall.bbox.w - (offsetM + widthM)) < 0.05;
        const street = (streetOrientation || 'S').toUpperCase();
        let doorPlaced = false;
        if ((street.includes('N') || street.includes('NE') || street.includes('NW') || street.includes('NORD')) && touchesTop) {
            elements.push({ id: uuidv4(), type: 'door', x: hx + hw / 2 - extDoorSizePx / 2, y: hy - thickPx / 2, width: extDoorSizePx, height: thickPx, rotation: 0 });
            doorPlaced = true;
        }
        else if ((street.includes('V') || street.includes('W') || street.includes('SV') || street.includes('NV') || street.includes('SW') || street.includes('NW') || street.includes('VEST')) && touchesLeft) {
            elements.push({ id: uuidv4(), type: 'door', x: hx - thickPx / 2, y: hy + hh / 2 - extDoorSizePx / 2, width: thickPx, height: extDoorSizePx, rotation: 0 });
            doorPlaced = true;
        }
        else if ((street.includes('E') || street.includes('SE') || street.includes('NE') || street.includes('EST')) && touchesRight) {
            elements.push({ id: uuidv4(), type: 'door', x: hx + hw - thickPx / 2, y: hy + hh / 2 - extDoorSizePx / 2, width: thickPx, height: extDoorSizePx, rotation: 0 });
            doorPlaced = true;
        }
        else if (touchesBottom) {
            elements.push({ id: uuidv4(), type: 'door', x: hx + hw / 2 - extDoorSizePx / 2, y: hy + hh - thickPx / 2, width: extDoorSizePx, height: thickPx, rotation: 0 });
            doorPlaced = true;
        }
        if (!doorPlaced) {
            if (touchesBottom)
                elements.push({ id: uuidv4(), type: 'door', x: hx + hw / 2 - extDoorSizePx / 2, y: hy + hh - thickPx / 2, width: extDoorSizePx, height: thickPx, rotation: 0 });
            else if (touchesTop)
                elements.push({ id: uuidv4(), type: 'door', x: hx + hw / 2 - extDoorSizePx / 2, y: hy - thickPx / 2, width: extDoorSizePx, height: thickPx, rotation: 0 });
            else if (touchesLeft)
                elements.push({ id: uuidv4(), type: 'door', x: hx - thickPx / 2, y: hy + hh / 2 - extDoorSizePx / 2, width: thickPx, height: extDoorSizePx, rotation: 0 });
            else if (touchesRight)
                elements.push({ id: uuidv4(), type: 'door', x: hx + hw - thickPx / 2, y: hy + hh / 2 - extDoorSizePx / 2, width: thickPx, height: extDoorSizePx, rotation: 0 });
        }
    }
    // 8. Generate Staircase
    const staircaseRoom = indoorRooms.find(ar => ar.hasStaircase);
    if (staircaseRoom) {
        const pr = partitionedRooms.find(r => r.id === staircaseRoom.id);
        if (pr) {
            const rx = Math.round(pr.bbox.x * PIXELS_PER_METER);
            const ry = Math.round(pr.bbox.y * PIXELS_PER_METER);
            const stairSize = Math.round(2 * PIXELS_PER_METER);
            elements.push({
                id: uuidv4(),
                type: 'staircase',
                x: rx + thickPx,
                y: ry + thickPx,
                width: stairSize,
                height: stairSize,
                rotation: 0,
            });
        }
    }
    console.log('Elements generated:', {
        total: elements.length,
        walls: elements.filter(e => e.type === 'wall').length,
        rooms: elements.filter(e => e.type === 'room').length,
        doors: elements.filter(e => e.type === 'door').length,
        windows: elements.filter(e => e.type === 'window').length,
        stairs: elements.filter(e => e.type === 'staircase').length,
        terraces: elements.filter(e => e.type === 'terasa').length,
    });
    return elements;
}
