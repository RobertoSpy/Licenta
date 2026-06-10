"use strict";
// frontend/src/utils/layout/treemap.ts
// Squarified treemap helpers extracted for modularity and isomorphic usage
Object.defineProperty(exports, "__esModule", { value: true });
exports.squarifyPartition = squarifyPartition;
function getWorstRatio(row, w) {
    if (row.length === 0)
        return Infinity;
    const s = row.reduce((a, b) => a + b, 0);
    if (s === 0)
        return Infinity;
    const minArea = Math.min(...row);
    const maxArea = Math.max(...row);
    const w2 = w * w;
    const s2 = s * s;
    return Math.max((w2 * maxArea) / s2, s2 / (w2 * minArea));
}
function layoutRow(row, x, y, w, h) {
    const sum = row.reduce((a, b) => a + b, 0);
    const rects = [];
    if (w >= h) {
        const rowWidth = sum / h;
        let currY = y;
        for (const area of row) {
            const rowHeight = area / rowWidth;
            rects.push({ x, y: currY, w: rowWidth, h: rowHeight });
            currY += rowHeight;
        }
        return { rects, nextX: x + rowWidth, nextY: y, nextW: w - rowWidth, nextH: h };
    }
    else {
        const rowHeight = sum / w;
        let currX = x;
        for (const area of row) {
            const rowWidth = area / rowHeight;
            rects.push({ x: currX, y, w: rowWidth, h: rowHeight });
            currX += rowWidth;
        }
        return { rects, nextX: x, nextY: y + rowHeight, nextW: w, nextH: h - rowHeight };
    }
}
function squarifyPartition(bbox, items, preserveOrder = false) {
    if (items.length === 0)
        return [];
    if (items.length === 1)
        return [{ id: items[0].id, bbox, original: items[0].original }];
    const totalArea = bbox.w * bbox.h;
    const totalWeight = items.reduce((s, item) => s + item.weight, 0);
    if (totalWeight <= 0) {
        return items.map(i => ({ id: i.id, bbox: Object.assign(Object.assign({}, bbox), { w: bbox.w / items.length }), original: i.original }));
    }
    const sorted = preserveOrder ? [...items] : [...items].sort((a, b) => b.weight - a.weight);
    const areas = sorted.map(i => (i.weight / totalWeight) * totalArea);
    const resultBBoxes = [];
    let remaining = [...areas];
    let curRow = [];
    let cx = bbox.x, cy = bbox.y, cw = bbox.w, ch = bbox.h;
    while (remaining.length > 0) {
        const minSide = Math.min(cw, ch);
        if (minSide <= 0.01) {
            for (const _ of remaining) {
                resultBBoxes.push({ x: cx, y: cy, w: cw, h: ch });
            }
            break;
        }
        const nextArea = remaining[0];
        if (curRow.length === 0) {
            curRow.push(nextArea);
            remaining.shift();
            continue;
        }
        const worstWithNext = getWorstRatio([...curRow, nextArea], minSide);
        const worstWithoutNext = getWorstRatio(curRow, minSide);
        if (worstWithNext <= worstWithoutNext) {
            curRow.push(nextArea);
            remaining.shift();
        }
        else {
            const rowResult = layoutRow(curRow, cx, cy, cw, ch);
            resultBBoxes.push(...rowResult.rects);
            cx = rowResult.nextX;
            cy = rowResult.nextY;
            cw = rowResult.nextW;
            ch = rowResult.nextH;
            curRow = [];
        }
    }
    if (curRow.length > 0) {
        const rowResult = layoutRow(curRow, cx, cy, cw, ch);
        resultBBoxes.push(...rowResult.rects);
    }
    return resultBBoxes.map((box, i) => ({
        id: sorted[i].id,
        bbox: box,
        original: sorted[i].original
    }));
}
