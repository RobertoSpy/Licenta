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
const bcrypt_1 = __importDefault(require("bcrypt"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../../.env') });
const prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Seeding contractors...');
        const password = yield bcrypt_1.default.hash('Contractor123!', 10);
        const c1 = yield prisma.user.upsert({
            where: { email: 'contact@buildconstruct.ro' },
            update: {},
            create: {
                email: 'contact@buildconstruct.ro',
                name: 'Ion Constructorescu',
                password,
                role: client_1.UserRole.CONTRACTOR,
                isVerified: true,
                contractor: {
                    create: {
                        companyName: 'Build Construct SRL',
                        cui: 'RO12345678',
                        county: 'București',
                        coverageRadius: 100,
                        specializations: [client_1.ContractorSpecialization.CONSTRUCTII_GENERALE, client_1.ContractorSpecialization.STRUCTURA, client_1.ContractorSpecialization.FUNDATII],
                        description: 'Experiență de peste 10 ani în construcții rezidențiale. Oferim calitate și seriozitate.',
                        isVerified: true,
                        isActive: true,
                        yearsExperience: 12,
                        completedProjects: 45,
                        avgRating: 4.8,
                    }
                }
            }
        });
        const c2 = yield prisma.user.upsert({
            where: { email: 'office@finisajepremium.ro' },
            update: {},
            create: {
                email: 'office@finisajepremium.ro',
                name: 'Vasile Zugrăvescu',
                password,
                role: client_1.UserRole.CONTRACTOR,
                isVerified: true,
                contractor: {
                    create: {
                        companyName: 'Finisaje Premium SRL',
                        cui: 'RO87654321',
                        county: 'Ilfov',
                        coverageRadius: 50,
                        specializations: [client_1.ContractorSpecialization.FINISAJE, client_1.ContractorSpecialization.INSTALATII_ELECTRICE, client_1.ContractorSpecialization.INSTALATII_SANITARE, client_1.ContractorSpecialization.INSTALATII_TERMICE],
                        description: 'Specialiști în finisaje interioare și exterioare. Executăm lucrări de calitate.',
                        isVerified: true,
                        isActive: true,
                        yearsExperience: 8,
                        completedProjects: 120,
                        avgRating: 4.5,
                    }
                }
            }
        });
        const c3 = yield prisma.user.upsert({
            where: { email: 'robertospiridon001@gmail.com' },
            update: {},
            create: {
                email: 'robertospiridon001@gmail.com',
                name: 'Roberto Spiridon',
                password,
                role: client_1.UserRole.CONTRACTOR,
                isVerified: true,
                contractor: {
                    create: {
                        companyName: 'Roberto Construct',
                        cui: 'RO99999999',
                        county: 'București',
                        coverageRadius: 200,
                        specializations: [client_1.ContractorSpecialization.CONSTRUCTII_GENERALE, client_1.ContractorSpecialization.STRUCTURA, client_1.ContractorSpecialization.FINISAJE, client_1.ContractorSpecialization.INSTALATII_ELECTRICE, client_1.ContractorSpecialization.INSTALATII_SANITARE, client_1.ContractorSpecialization.INSTALATII_TERMICE],
                        description: 'Constructor premium full-service. Execut lucrări de calitate.',
                        isVerified: true,
                        isActive: true,
                        yearsExperience: 5,
                        completedProjects: 15,
                        avgRating: 5.0,
                    }
                }
            }
        });
        console.log(`Created contractors: ${c1.email}, ${c2.email}, ${c3.email}`);
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
