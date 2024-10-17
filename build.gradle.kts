import org.apache.tools.ant.taskdefs.condition.Os

plugins {
    id("com.avast.gradle.docker-compose") version "0.17.10"
}

tasks {
    register<Exec>("test") {
        executable = getNpm()
        args("run", "build-test")
    }
    register("cleanPackDir") {
        file("pack/").mkdirs()
        file("pack/").listFiles()?.forEach { it.delete() }
    }

    register("cleanE2EDir") {
        file("e2e/").listFiles()?.forEach { if (it.name.endsWith(".tgz")) it.delete() }
    }

    register<Exec>("installModules") {
        executable = getNpm()
        args("install")
    }

    register<Exec>("makeDist") {
        dependsOn("cleanPackDir")
        dependsOn("installModules")
        executable = getNpm()
        args("run", "build")
    }

    register<Exec>("buildDist") {
        dependsOn("makeDist")
        executable = getNpm()
        args("pack", "--pack-destination=./pack")
    }
}

dockerCompose {
    waitForTcpPorts.set(false)
}

// Make npm work on Windows
fun getNpm(): String {
    return if (Os.isFamily(Os.FAMILY_WINDOWS)) {
        "npm.cmd"
    } else {
        "npm"
    }
}

if (hasProperty("buildScan")) {
    extensions.findByName("buildScan")?.withGroovyBuilder {
        setProperty("termsOfServiceUrl", "https://gradle.com/terms-of-service")
        setProperty("termsOfServiceAgree", "yes")
    }
}
