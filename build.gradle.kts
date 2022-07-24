plugins {
    id("com.avast.gradle.docker-compose") version "0.16.8"
    id("org.jetbrains.kotlin.jvm") version "1.7.10"
}


val probeGroup: String by project
val jacksonVersion: String by project
val vertxVersion: String by project
val jupiterVersion: String by project
val logbackVersion: String by project
val sppVersion: String by project

repositories {
    mavenCentral()
    maven(url = "https://jitpack.io")
    maven(url = "https://pkg.sourceplus.plus/sourceplusplus/protocol")
}

dependencies {
    implementation("io.vertx:vertx-tcp-eventbus-bridge:$vertxVersion")
    implementation("com.fasterxml.jackson.dataformat:jackson-dataformat-yaml:$jacksonVersion")
    implementation("plus.sourceplus:protocol:$sppVersion") {
        isTransitive = false
    }

    implementation("org.jetbrains.kotlinx:kotlinx-datetime:0.4.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.3.3")

    testImplementation("org.junit.jupiter:junit-jupiter-engine:$jupiterVersion")
    testImplementation("io.vertx:vertx-junit5:$vertxVersion")
    testImplementation("io.vertx:vertx-web-client:$vertxVersion")
    testImplementation("ch.qos.logback:logback-classic:$logbackVersion")
    testImplementation("io.vertx:vertx-service-proxy:$vertxVersion")
    testImplementation("io.vertx:vertx-service-discovery:$vertxVersion")
    testImplementation("io.vertx:vertx-lang-kotlin-coroutines:$vertxVersion")
}

sourceSets.test {
    java.srcDirs("test/java", "test/kotlin")
    resources.srcDirs("test/resources")
}

tasks {
    register("cleanPackDir") {
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
