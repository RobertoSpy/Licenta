"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFloorHeightM = getFloorHeightM;
function getFloorHeightM(hasBasement, activeFloor) {
    if (hasBasement && activeFloor === 'subsol')
        return 1.9;
    return 2.7;
}
