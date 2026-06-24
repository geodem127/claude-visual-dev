"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBranch = createBranch;
exports.checkoutMain = checkoutMain;
exports.applyVariant = applyVariant;
exports.deleteBranch = deleteBranch;
exports.commitFile = commitFile;
const simple_git_1 = __importDefault(require("simple-git"));
const fs = __importStar(require("fs/promises"));
async function createBranch(repoPath, branch) {
    const git = (0, simple_git_1.default)(repoPath);
    await git.checkoutLocalBranch(branch);
}
async function checkoutMain(repoPath) {
    const git = (0, simple_git_1.default)(repoPath);
    const branches = await git.branchLocal();
    const main = branches.all.find(b => b === 'main' || b === 'master') ?? 'main';
    await git.checkout(main);
}
async function applyVariant(repoPath, branch, filePath) {
    const git = (0, simple_git_1.default)(repoPath);
    const content = await git.show([`${branch}:${filePath}`]);
    const absPath = `${repoPath}/${filePath}`;
    await fs.writeFile(absPath, content, 'utf-8');
    await checkoutMain(repoPath);
    await deleteBranch(repoPath, branch);
}
async function deleteBranch(repoPath, branch) {
    const git = (0, simple_git_1.default)(repoPath);
    const current = (await git.branchLocal()).current;
    if (current === branch) {
        await checkoutMain(repoPath);
    }
    await git.deleteLocalBranch(branch, true);
}
async function commitFile(repoPath, filePath, message) {
    const git = (0, simple_git_1.default)(repoPath);
    await git.add(filePath);
    await git.commit(message);
}
