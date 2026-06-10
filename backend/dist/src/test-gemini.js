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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const genai_1 = require("@google/genai");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const ai = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
function test() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, e_1, _b, _c;
        const prompt = `Ești Zidario, consultant tehnic pentru construcții rezidențiale românești.

SARCINI (răspunde structurat, maxim 200 cuvinte, în română):
1. ✅/❌ COMPATIBILITATE: Este alternativa compatibilă cu zona seismică mare și solul pietros?
2. 🔧 COMPATIBILITATE MATERIALE: Se potrivește cu celelalte materiale alese în deviz?
3. 🌡️ IMPACT ENERGETIC: Cum afectează clasa energetică? (compară U-values dacă disponibile)
4. 💰 VERDICT FINANCIAR: Merită diferența de preț pentru acest proiect specific?
5. 📋 NORMATIVE: Citează articolul exact dacă există restricții (CR6-2013, NE012-1:2022, Mc-001-2022, P100-1/2013).

IMPORTANT: Dacă alternativa este incompatibilă cu zona seismică sau solul, spune NU clar și motivează.`;
        try {
            const stream = yield ai.models.generateContentStream({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { maxOutputTokens: 400, temperature: 0.2 }
            });
            try {
                for (var _d = true, stream_1 = __asyncValues(stream), stream_1_1; stream_1_1 = yield stream_1.next(), _a = stream_1_1.done, !_a; _d = true) {
                    _c = stream_1_1.value;
                    _d = false;
                    const chunk = _c;
                    console.log('CHUNK RAW:', JSON.stringify(chunk, null, 2));
                    console.log('CHUNK TEXT:', chunk.text);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = stream_1.return)) yield _b.call(stream_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        catch (e) {
            console.error('ERROR:', e);
        }
    });
}
test();
