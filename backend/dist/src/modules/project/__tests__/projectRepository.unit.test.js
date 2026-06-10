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
const projectRepository_1 = require("../projectRepository");
const setup_1 = require("../../../../tests/setup");
describe('Project Repository', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('findById', () => {
        it('returns project with bomItems included', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockProject = { id: 1, title: 'Test' };
            setup_1.prismaMock.project.findUnique.mockResolvedValue(mockProject);
            const result = yield projectRepository_1.projectRepository.findById(1);
            expect(setup_1.prismaMock.project.findUnique).toHaveBeenCalledWith({
                where: { id: 1 },
                include: {
                    bomItems: {
                        include: {
                            material: true
                        }
                    }
                }
            });
            expect(result).toEqual(mockProject);
        }));
    });
    describe('findManyByUserId', () => {
        it('returns projects ordered by createdAt desc with bomItems', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockProjects = [{ id: 1, title: 'Test' }];
            setup_1.prismaMock.project.findMany.mockResolvedValue(mockProjects);
            const result = yield projectRepository_1.projectRepository.findManyByUserId(1);
            expect(setup_1.prismaMock.project.findMany).toHaveBeenCalledWith({
                where: { userId: 1 },
                orderBy: { createdAt: 'desc' },
                include: {
                    bomItems: true
                }
            });
            expect(result).toEqual(mockProjects);
        }));
    });
    describe('create', () => {
        it('creates project', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockProject = { id: 1, title: 'New' };
            setup_1.prismaMock.project.create.mockResolvedValue(mockProject);
            const result = yield projectRepository_1.projectRepository.create({ title: 'New' });
            expect(setup_1.prismaMock.project.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ title: 'New' }) }));
            expect(result).toEqual(mockProject);
        }));
    });
    describe('update', () => {
        it('updates project', () => __awaiter(void 0, void 0, void 0, function* () {
            const mockProject = { id: 1, title: 'Updated' };
            setup_1.prismaMock.project.update.mockResolvedValue(mockProject);
            const result = yield projectRepository_1.projectRepository.update(1, { title: 'Updated' });
            expect(setup_1.prismaMock.project.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { title: 'Updated' }
            });
            expect(result).toEqual(mockProject);
        }));
    });
    describe('delete', () => {
        it('deletes project', () => __awaiter(void 0, void 0, void 0, function* () {
            setup_1.prismaMock.project.delete.mockResolvedValue({ id: 1 });
            yield projectRepository_1.projectRepository.delete(1);
            expect(setup_1.prismaMock.project.delete).toHaveBeenCalledWith({ where: { id: 1 } });
        }));
    });
});
