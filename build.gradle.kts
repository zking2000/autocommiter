plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "1.8.0"
    id("org.jetbrains.intellij") version "1.13.0"
}

group = "com.github.autocommiter"
version = "1.0-SNAPSHOT"

repositories {
    mavenCentral()
}

intellij {
    version.set("2023.3.3")
    type.set("IU")
    plugins.set(listOf("Git4Idea"))
}

tasks {
    withType<JavaCompile> {
        sourceCompatibility = "17"
        targetCompatibility = "17"
    }
    withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
        kotlinOptions.jvmTarget = "17"
    }

    patchPluginXml {
        sinceBuild.set("233")
        untilBuild.set("241.*")
    }
} 