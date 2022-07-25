plugins {
    id("com.avast.gradle.docker-compose") version "0.16.8"
}

tasks {
    register("cleanPackDir") {
        file("pack/").mkdirs()
        file("pack/").listFiles()?.forEach { it.delete() }
    }

    register("cleanE2EDir") {
        file("e2e/").listFiles()?.forEach { if (it.name.endsWith(".tgz")) it.delete() }
    }

    register<Exec>("makeDist") {
        dependsOn("cleanPackDir")
        executable = "npm"
        args("run", "build")
    }

    register<Exec>("buildDist") {
        dependsOn("makeDist")
        executable = "npm"
        args("pack", "--pack-destination=./pack")
    }

    register<Copy>("updateDockerFiles") {
        dependsOn("buildDist", "cleanE2EDir")
        from("pack/")
        into("e2e/")
    }

    register("assembleUp") {
        dependsOn("updateDockerFiles", "composeUp")
    }
    getByName("composeUp").mustRunAfter("updateDockerFiles")
}

dockerCompose {
    dockerComposeWorkingDirectory.set(File("./e2e"))
    removeVolumes.set(true)
    waitForTcpPorts.set(false)
}
