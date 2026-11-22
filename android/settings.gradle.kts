pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode = RepositoriesMode.FAIL_ON_PROJECT_REPOS
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "der-android"

include(":app")

include(":core:data")
include(":core:domain")
include(":core:design")
include(":core:sync")
include(":core:offline")
include(":core:auth")
include(":core:p2p")
include(":core:rules")

// Feature modules mirror the DER app concepts. Data Entry handles
// aggregate datasets; Capture handles tracker + event programs; Workflow
// enforces service-point step routing (ADR-0022..0026, ADR-0041).
include(":feature:dataentry")
include(":feature:capture")
include(":feature:workflow")
include(":feature:dashboard")
include(":feature:approvals")
include(":feature:devices")
include(":feature:settings")
