package com.github.autocommiter

import com.intellij.openapi.fileEditor.FileDocumentManagerListener
import com.intellij.openapi.vfs.VirtualFile
import git4idea.GitUtil
import git4idea.commands.Git
import git4idea.commands.GitCommand
import git4idea.commands.GitLineHandler
import com.intellij.openapi.project.ProjectManager
import java.io.File
import com.intellij.openapi.vcs.VcsRoot
import git4idea.repo.GitRepository
import com.intellij.openapi.editor.Document
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.ModalityState
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task

class AutoCommiterPlugin : FileDocumentManagerListener {
    private val LOG = Logger.getInstance(AutoCommiterPlugin::class.java)

    override fun beforeDocumentSaving(document: Document) {
        LOG.info("Document saving triggered")
        
        if (!AutoCommiterSettings.getInstance().enabled) {
            LOG.info("Plugin is disabled")
            return
        }

        val project = ProjectManager.getInstance().openProjects.firstOrNull() ?: run {
            LOG.info("No open project found")
            return
        }

        val file = document.virtualFile ?: run {
            LOG.info("No virtual file found for document")
            return
        }

        ProgressManager.getInstance().run(
            object : Task.Backgroundable(project, "Auto Committing Changes") {
                override fun run(indicator: com.intellij.openapi.progress.ProgressIndicator) {
                    try {
                        LOG.info("Processing file: ${file.path}")
                        
                        // 获取Git根目录
                        val gitRepository = GitUtil.getRepositoryManager(project).getRepositoryForFile(file)
                        val gitDir = gitRepository?.root ?: run {
                            LOG.info("No git repository found for file")
                            return
                        }

                        // 检查.autocommiter文件是否存在
                        val autoCommiterFile = File(gitDir.path, ".autocommiter")
                        if (!autoCommiterFile.exists()) {
                            LOG.info(".autocommiter file not found in ${gitDir.path}")
                            return
                        }

                        // Git add
                        LOG.info("Executing git add")
                        val addHandler = GitLineHandler(project, gitDir, GitCommand.ADD)
                        addHandler.addParameters(file.path)
                        Git.getInstance().runCommand(addHandler).throwOnError()

                        // Git commit
                        LOG.info("Executing git commit")
                        val commitHandler = GitLineHandler(project, gitDir, GitCommand.COMMIT)
                        commitHandler.addParameters("-m", "Auto commit: ${file.name}")
                        Git.getInstance().runCommand(commitHandler).throwOnError()

                        // Git push
                        LOG.info("Executing git push")
                        val pushHandler = GitLineHandler(project, gitDir, GitCommand.PUSH)
                        Git.getInstance().runCommand(pushHandler).throwOnError()
                        
                        LOG.info("Auto commit and push completed successfully")
                    } catch (e: Exception) {
                        LOG.error("Error during git operations", e)
                    }
                }
            }
        )
    }

    private val Document.virtualFile: VirtualFile?
        get() = com.intellij.openapi.fileEditor.FileDocumentManager.getInstance().getFile(this)
} 