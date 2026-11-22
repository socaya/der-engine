plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
}

android {
    namespace = "org.der.android"
    compileSdk = 35

    defaultConfig {
        applicationId = "org.der.android"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0-alpha"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables.useSupportLibrary = true

        val derServerUrl = providers.gradleProperty("der.server.url").orNull
            ?: "http://10.0.2.2:8085"
        buildConfigField("String", "DER_SERVER_URL", "\"$derServerUrl\"")
    }

    // Release keystore config read from gradle properties so the key
    // material never lands in git. Operators set these in
    // ~/.gradle/gradle.properties or local.properties:
    //   der.release.keystore=path/to/keystore.jks
    //   der.release.keystorePassword=...
    //   der.release.keyAlias=...
    //   der.release.keyPassword=...
    // When unset, release builds fall back to debug signing so a CI
    // laptop that doesn't hold the release key still produces a
    // working APK/AAB.
    val releaseKeystore = providers.gradleProperty("der.release.keystore").orNull
    val releaseKeystorePassword =
        providers.gradleProperty("der.release.keystorePassword").orNull
    val releaseKeyAlias = providers.gradleProperty("der.release.keyAlias").orNull
    val releaseKeyPassword = providers.gradleProperty("der.release.keyPassword").orNull
    val hasReleaseKey = releaseKeystore != null && releaseKeystorePassword != null
        && releaseKeyAlias != null && releaseKeyPassword != null

    signingConfigs {
        if (hasReleaseKey) {
            create("release") {
                storeFile = file(releaseKeystore!!)
                storePassword = releaseKeystorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            signingConfig = if (hasReleaseKey) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }

    bundle {
        language { enableSplit = true }
        density { enableSplit = true }
        abi { enableSplit = true }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation(project(":core:design"))
    implementation(project(":core:data"))
    implementation(project(":core:domain"))
    implementation(project(":core:auth"))
    implementation(project(":core:sync"))
    implementation(project(":core:offline"))
    implementation(project(":core:p2p"))
    implementation(project(":feature:dataentry"))
    implementation(project(":feature:capture"))
    implementation(project(":feature:workflow"))
    implementation(project(":feature:dashboard"))
    implementation(project(":feature:approvals"))
    implementation(project(":feature:devices"))
    implementation(project(":feature:settings"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.activity.compose)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)

    implementation(libs.androidx.navigation.compose)

    implementation(libs.hilt.android)
    implementation(libs.hilt.navigation.compose)
    implementation(libs.androidx.hilt.work)
    ksp(libs.hilt.compiler)

    implementation(libs.androidx.work.runtime.ktx)
    implementation(libs.androidx.biometric)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.camera.core)
    implementation(libs.androidx.camera.camera2)
    implementation(libs.androidx.camera.lifecycle)
    implementation(libs.androidx.camera.view)
    implementation(libs.mlkit.barcode.scanning)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.kotlinx.coroutines.android)

    implementation(libs.timber)

    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)

    testImplementation(libs.junit)
    testImplementation(libs.mockk)
    testImplementation(libs.turbine)
    testImplementation(libs.kotlinx.coroutines.test)

    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
}
