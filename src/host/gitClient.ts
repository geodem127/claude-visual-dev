import simpleGit from 'simple-git';
import * as fs from 'fs/promises';

export async function createBranch(repoPath: string, branch: string): Promise<void> {
  const git = simpleGit(repoPath);
  await git.checkoutLocalBranch(branch);
}

export async function checkoutMain(repoPath: string): Promise<void> {
  const git = simpleGit(repoPath);
  const branches = await git.branchLocal();
  const main = branches.all.find(b => b === 'main' || b === 'master') ?? 'main';
  await git.checkout(main);
}

export async function applyVariant(repoPath: string, branch: string, filePath: string): Promise<void> {
  const git = simpleGit(repoPath);
  const content = await git.show([`${branch}:${filePath}`]);
  const absPath = `${repoPath}/${filePath}`;
  await fs.writeFile(absPath, content, 'utf-8');
  await checkoutMain(repoPath);
  await deleteBranch(repoPath, branch);
}

export async function deleteBranch(repoPath: string, branch: string): Promise<void> {
  const git = simpleGit(repoPath);
  const current = (await git.branchLocal()).current;
  if (current === branch) {
    await checkoutMain(repoPath);
  }
  await git.deleteLocalBranch(branch, true);
}

export async function commitFile(repoPath: string, filePath: string, message: string): Promise<void> {
  const git = simpleGit(repoPath);
  await git.add(filePath);
  await git.commit(message);
}
