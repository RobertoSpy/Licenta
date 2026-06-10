"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.terrainService = void 0;
const geospatialService_1 = require("./geospatialService");
exports.terrainService = {
    analyzeLocation(input) {
        return __awaiter(this, void 0, void 0, function* () {
            const { lat, lng } = input;
            let county = input.county || '';
            let locality = '';
            if (lat != null && lng != null) {
                if (lat === 0 && lng === 0) {
                    throw new Error('Unable to determine county from coordinates: 0,0 (Null Island) is invalid.');
                }
                const geoData = yield geospatialService_1.geospatialService.reverseGeocode(Number(lat), Number(lng));
                if (geoData) {
                    county = county || geoData.county;
                    locality = geoData.locality;
                }
            }
            if (!county) {
                throw new Error('Unable to determine county from coordinates or input.');
            }
            const seismic = geospatialService_1.geospatialService.getSeismicZone(county);
            const frost = geospatialService_1.geospatialService.getFrostDepth(county);
            return {
                county,
                locality,
                seismicZone: (seismic === null || seismic === void 0 ? void 0 : seismic.ag) || '0.20g',
                frostDepthCm: frost || 90
            };
        });
    }
};
