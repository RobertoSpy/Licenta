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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../../.env') });
const prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Ștergere utilizatori normali (CLIENT)...');
        const deletedClients = yield prisma.user.deleteMany({
            where: {
                role: client_1.UserRole.CLIENT
            }
        });
        console.log(`✅ Au fost șterși ${deletedClients.count} utilizatori normali.`);
        console.log('Actualizare email Admin...');
        const existingAdmin = yield prisma.user.findFirst({
            where: { role: client_1.UserRole.ADMIN }
        });
        if (existingAdmin) {
            yield prisma.user.update({
                where: { id: existingAdmin.id },
                data: { email: 'robertospiridon1@gmail.com' }
            });
            console.log('✅ Email-ul de Admin a fost actualizat la robertospiridon1@gmail.com.');
        }
        else {
            console.log('❌ Nu am găsit niciun admin existent. Poți rula scriptul de seedAdmin.ts.');
        }
    });
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
}));
