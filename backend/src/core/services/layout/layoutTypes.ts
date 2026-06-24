export interface CanvasElement {
  id: string;
  type: string;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  wallThicknessCm?: number;
  metadata?: Record<string, any>;
}

import constants from '../../../data/layout-constants.json';

export const PIXELS_PER_METER = constants.pixels_per_meter;
export const LAYOUT_CONSTANTS = constants;

export const ARCHITECTURAL_STANDARDS = {
  DOOR: {
    RESIDENTIAL_INTERIOR: constants.door.interior_m, // metri (Standard Legea 114)
    RESIDENTIAL_EXTERIOR: constants.door.exterior_m, // metri (Ușă intrare standard)
    COMMERCIAL_MINIMUM: 0.9,   // metri (Standard evacuare P118-99)
    BATHROOM: constants.door.bathroom_m,             // metri (Standard uzual)
  },
  WINDOW: {
    STANDARD_WIDTH: constants.window.standard_width_m,       // metri
  },
  WALL: {
    EXTERIOR_THICKNESS: constants.wall.exterior_thickness_m,  // metri
    INTERIOR_THICKNESS: constants.wall.interior_thickness_m, // metri
  }
};

export interface ConfiguratorRoom {
  id: string;
  type?: string;
  label: string;
  ratioValue: number; // 1 = Mic, 2 = Mediu, 3 = Mare
  minSqm?: number;
  maxSqm?: number;
  mustAdjacentTo?: string[];
  hasDoorTo?: string[];
  isCirculation?: boolean;
  hasStaircase?: boolean;
  naturalLight?: boolean;
  orientation?: string[];
  zone?: string;
}

export interface ConfiguratorDimensions {
  widthM: number;
  heightM: number;
  wingWidthM?: number;
  wingLengthM?: number;
}

// Bounding box interface in meters
export interface BBoxM {
  x: number;
  y: number;
  w: number;
  h: number;
}
