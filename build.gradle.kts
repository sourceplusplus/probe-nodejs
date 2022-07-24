plugins {
    id("com.avast.gradle.docker-compose") version "0.16.8"
}

tasks {
    register("cleanPackDir") {
        file("pack/").delete()
        file("pack/").mkdirs()
    }

    register<Exec>("buildDist") {
        dependsOn("cleanPackDir")
        executable = "npm"
        args("pack", "--pack-destination=./pack")
    }

    register<Copy>("updateDockerFiles") {
        dependsOn("buildDist")
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