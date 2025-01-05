"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const gitService_1 = require("./gitService");
function activate(context) {
    const gitService = new gitService_1.GitService();
    // 创建状态栏按钮
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'autocommiter.toggleEnable';
    context.subscriptions.push(statusBarItem);
    // 更新状态栏显示
    function updateStatusBar() {
        const enabled = vscode.workspace.getConfiguration('autocommiter').get('enabled', true);
        statusBarItem.text = enabled ? "$(check) Auto Commit" : "$(x) Auto Commit";
        statusBarItem.tooltip = enabled ? "Click to disable Auto Commit" : "Click to enable Auto Commit";
        statusBarItem.show();
    }
    // 注册切换命令
    let toggleCommand = vscode.commands.registerCommand('autocommiter.toggleEnable', () => {
        const enabled = vscode.workspace.getConfiguration('autocommiter').get('enabled', true);
        vscode.workspace.getConfiguration('autocommiter').update('enabled', !enabled, true);
        updateStatusBar();
        vscode.window.showInformationMessage(`Auto Commiter ${!enabled ? 'enabled' : 'disabled'}`);
    });
    // 监听文件保存和删除事件
    let fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**/*');
    // 文件保存事件
    let saveListener = vscode.workspace.onDidSaveTextDocument(async (document) => {
        const enabled = vscode.workspace.getConfiguration('autocommiter').get('enabled', true);
        if (!enabled) {
            return;
        }
        await gitService.processGitOperations(document.uri, 'modified');
    });
    // 文件删除事件
    let deleteListener = fileSystemWatcher.onDidDelete(async (uri) => {
        const enabled = vscode.workspace.getConfiguration('autocommiter').get('enabled', true);
        if (!enabled) {
            return;
        }
        await gitService.processGitOperations(uri, 'deleted');
    });
    // 监听配置变化
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('autocommiter.enabled')) {
            updateStatusBar();
        }
    }));
    context.subscriptions.push(toggleCommand, saveListener, deleteListener, fileSystemWatcher);
    updateStatusBar(); // 初始化状态栏
}
function deactivate() { }
//# sourceMappingURL=extension.js.map