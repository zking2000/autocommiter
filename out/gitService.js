"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitService = void 0;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class GitService {
    constructor() {
        this.isWindows = process.platform === 'win32';
        this.output = vscode.window.createOutputChannel('Auto Commiter');
    }
    async findGitRoot(filePath) {
        let current = path.dirname(filePath);
        while (current) {
            const gitDir = path.join(current, '.git');
            if (fs.existsSync(gitDir)) {
                return current;
            }
            const parent = path.dirname(current);
            if (parent === current) {
                break;
            }
            current = parent;
        }
        return undefined;
    }
    getGitCommand() {
        return this.isWindows ? 'git.exe' : 'git';
    }
    async executeGitCommand(cwd, ...args) {
        const gitCommand = this.getGitCommand();
        const command = [gitCommand, ...args.map(arg => `"${arg.replace(/"/g, '\\"')}"`)].join(' ');
        this.output.appendLine(`Executing: ${command} in ${cwd}`);
        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd,
                env: {
                    ...process.env,
                    LANG: 'en_US.UTF-8',
                    LC_ALL: 'en_US.UTF-8',
                    GIT_TERMINAL_PROMPT: '0',
                    GIT_ASKPASS: this.isWindows ? 'git-gui--askpass' : undefined
                }
            });
            if (stderr) {
                this.output.appendLine(`stderr: ${stderr}`);
            }
            if (stdout) {
                this.output.appendLine(`stdout: ${stdout}`);
            }
            return stdout;
        }
        catch (error) {
            const err = error;
            this.output.appendLine(`Error: ${err.message}`);
            throw err;
        }
    }
    async processGitOperations(file) {
        try {
            const gitRoot = await this.findGitRoot(file.fsPath);
            if (!gitRoot) {
                this.output.appendLine('No git repository found');
                return;
            }
            // 检查 .autocommiter 文件
            const autoCommiterFile = path.join(gitRoot, '.autocommiter');
            if (!fs.existsSync(autoCommiterFile)) {
                this.output.appendLine('.autocommiter file not found');
                return;
            }
            // 检查 Git 配置
            try {
                await this.executeGitCommand(gitRoot, 'config', 'user.name');
                await this.executeGitCommand(gitRoot, 'config', 'user.email');
            }
            catch (error) {
                const err = error;
                vscode.window.showErrorMessage('Git user configuration not found. Please configure git user.name and user.email');
                return;
            }
            // Git add
            await this.executeGitCommand(gitRoot, 'add', file.fsPath);
            // 检查是否有更改
            try {
                await this.executeGitCommand(gitRoot, 'diff', '--staged', '--quiet');
                this.output.appendLine('No changes to commit');
                return;
            }
            catch {
                // 如果有更改，git diff 会返回非零退出码
            }
            // Git commit
            const commitMessage = `Auto commit: ${path.basename(file.fsPath)}`;
            await this.executeGitCommand(gitRoot, 'commit', '-m', commitMessage);
            // 检查远程仓库
            try {
                await this.executeGitCommand(gitRoot, 'remote', 'get-url', 'origin');
            }
            catch (error) {
                const err = error;
                vscode.window.showErrorMessage('No remote repository configured');
                return;
            }
            // Git push with progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Pushing changes...",
                cancellable: false
            }, async () => {
                try {
                    await this.executeGitCommand(gitRoot, 'push');
                    vscode.window.showInformationMessage('Successfully pushed changes');
                }
                catch (error) {
                    const err = error;
                    vscode.window.showErrorMessage('Failed to push changes: ' + err.message);
                    throw err;
                }
            });
            this.output.appendLine('Auto commit and push completed successfully');
        }
        catch (error) {
            const err = error;
            vscode.window.showErrorMessage(`Git operation failed: ${err.message}`);
            this.output.appendLine(`Error: ${err.message}`);
        }
    }
}
exports.GitService = GitService;
//# sourceMappingURL=gitService.js.map