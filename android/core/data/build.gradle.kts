plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
}

android {
    namespace = "org.der.android.core.data"
    compileSdk = 35
    defaultConfig {
        minSdk = 24
        buildConfigField(
            "String", "DER_SERVER_URL",
            "\"${providers.gradleProperty("der.server.url").orNull ?: "http://10.0.2.2:8085"}\"",
        )
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { buildConfig = true }
}

dependencies {
    implementation(project(":core:domain"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.json)

    api(libs.retrofit)
    implementation(libs.retrofit.kotlinx.serialization.converter)
    api(libs.okhttp)
    implementation(libs.okhttp.logging)

    api(libs.androidx.datastore.preferences)

    api(libs.room.runtime)
    api(libs.room.ktx)
    ksp(libs.room.compiler)

    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)

    testImplementation(libs.junit)
    testImplementation(libs.mockk)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.turbine)
}
