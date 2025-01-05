package com.github.autocommiter

import com.intellij.openapi.fileEditor.FileDocumentManagerListener
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.project.ProjectManager
import java.io.File
import com.intellij.openapi.editor.Document
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import java.io.BufferedReader
import java.io.InputStreamReader
import com.intellij.openapi.vfs.VfsUtil

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
                        val gitDir = findGitRoot(File(file.path)) ?: run {
                            LOG.info("No git repository found for file")
                            return
                        }

                        // 检查.autocommiter文件是否存在
                        val autoCommiterFile = File(gitDir, ".autocommiter")
                        if (!autoCommiterFile.exists()) {
                            LOG.info(".autocommiter file not found in ${gitDir.path}")
                            return
                        }

                        // Git add
                        LOG.info("Executing git add")
                        executeGitCommand(gitDir, "add", file.path)

                        // Git commit
                        LOG.info("Executing git commit")
                        executeGitCommand(gitDir, "commit", "-m", "Auto commit: ${file.name}")

                        // Git push
                        LOG.info("Executing git push")
                        executeGitCommand(gitDir, "push")
                        
                        LOG.info("Auto commit and push completed successfully")
                    } catch (e: Exception) {
                        LOG.error("Error during git operations", e)
                    }
                }
            }
        )
    }

    private fun findGitRoot(file: File): File? {
        var current = file.parentFile
        while (current != null) {
            if (File(current, ".git").exists()) {
                return current
            }
            current = current.parentFile
        }
        return null
    }

    private fun executeGitCommand(workingDir: File, vararg command: String) {
        val fullCommand = listOf("git") + command
        val process = ProcessBuilder(fullCommand)
            .directory(workingDir)
            .redirectErrorStream(true)
            .start()

        val reader = BufferedReader(InputStreamReader(process.inputStream))
        var line: String?
        while (reader.readLine().also { line = it } != null) {
            LOG.info("Git output: $line")
        }

        val exitCode = process.waitFor()
        if (exitCode != 0) {
            throw RuntimeException("Git command failed with exit code $exitCode")
        }
    }

    private val Document.virtualFile: VirtualFile?
        get() = com.intellij.openapi.fileEditor.FileDocumentManager.getInstance().getFile(this)
} 