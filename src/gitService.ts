import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitService {
    private isWindows: boolean;
    private output: vscode.OutputChannel;
    private operationQueue: Promise<void>;

    constructor() {
        this.isWindows = process.platform === 'win32';
        this.output = vscode.window.createOutputChannel('Auto Commiter');
        this.operationQueue = Promise.resolve();
    }

    private async findGitRoot(filePath: string): Promise<string | undefined> {
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

    private getGitCommand(): string {
        return this.isWindows ? 'git.exe' : 'git';
    }

    private async executeGitCommand(cwd: string, ...args: string[]): Promise<string> {
        const gitCommand = this.getGitCommand();
        
        // 对参数进行适当的转义和引用
        const escapedArgs = args.map(arg => {
            // 对于 Windows 路径，将反斜杠转换为正斜杠
            if (this.isWindows) {
                arg = arg.replace(/\\/g, '/');
            }
            // 如果参数包含空格，用双引号包裹
            if (arg.includes(' ')) {
                return `"${arg.replace(/"/g, '\\"')}"`;
            }
            return arg;
        });

        const commandLine = `${gitCommand} ${escapedArgs.join(' ')}`;
        this.output.appendLine(`Executing: ${commandLine} in ${cwd}`);

        try {
            const { stdout, stderr } = await execAsync(commandLine, {
                cwd,
                env: {
                    ...process.env,
                    LANG: 'en_US.UTF-8',
                    LC_ALL: 'en_US.UTF-8',
                    GIT_TERMINAL_PROMPT: '0',
                    GIT_ASKPASS: this.isWindows ? 'git-gui--askpass' : undefined
                },
                windowsHide: true,
                maxBuffer: 10 * 1024 * 1024
            });

            if (stderr) {
                this.output.appendLine(`stderr: ${stderr}`);
            }
            if (stdout) {
                this.output.appendLine(`stdout: ${stdout}`);
            }

            return stdout;
        } catch (error) {
            const err = error as Error;
            this.output.appendLine(`Error: ${err.message}`);
            throw err;
        }
    }

    async processGitOperations(file: vscode.Uri, changeType: 'modified' | 'deleted'): Promise<void> {
        // 使用队列确保操作按顺序执行
        this.operationQueue = this.operationQueue.then(() => this.doProcessGitOperations(file, changeType));
    }

    private async doProcessGitOperations(file: vscode.Uri, changeType: 'modified' | 'deleted'): Promise<void> {
        try {
            const gitRoot = await this.findGitRoot(file.fsPath);
            if (!gitRoot) {
                this.output.appendLine('No git repository found');
                return;
            }

            // 获取相对于 git 仓库根目录的文件路径
            const relativePath = path.relative(gitRoot, file.fsPath);
            
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
            } catch (error) {
                const err = error as Error;
                vscode.window.showErrorMessage('Git user configuration not found. Please configure git user.name and user.email');
                return;
            }

            if (changeType === 'deleted') {
                try {
                    // 对于删除的文件，使用 git rm，使用相对路径
                    await this.executeGitCommand(gitRoot, 'rm', relativePath);
                } catch (error) {
                    // 如果文件已经被删除，尝试直接添加更改
                    await this.executeGitCommand(gitRoot, 'add', relativePath);
                }
            } else {
                // 对于修改的文件，使用 git add，使用相对路径
                await this.executeGitCommand(gitRoot, 'add', relativePath);
            }

            // 检查是否有更改
            try {
                await this.executeGitCommand(gitRoot, 'diff', '--staged', '--quiet');
                this.output.appendLine('No changes to commit');
                return;
            } catch {
                // 如果有更改，git diff 会返回非零退出码
            }

            // Git commit
            const action = changeType === 'deleted' ? 'Delete' : 'Update';
            const fileName = path.basename(file.fsPath);
            await this.executeGitCommand(
                gitRoot,
                'commit',
                '-m',
                `APICLOUD-1234 - Auto ${action.toLowerCase()}: ${fileName}`  // 作为单个参数传递
            );

            // 检查远程仓库
            try {
                await this.executeGitCommand(gitRoot, 'remote', 'get-url', 'origin');
            } catch (error) {
                const err = error as Error;
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
                } catch (error) {
                    const err = error as Error;
                    vscode.window.showErrorMessage('Failed to push changes: ' + err.message);
                    throw err;
                }
            });

            this.output.appendLine('Auto commit and push completed successfully');
        } catch (error) {
            const err = error as Error;
            vscode.window.showErrorMessage(`Git operation failed: ${err.message}`);
            this.output.appendLine(`Error: ${err.message}`);
        }
    }
} 