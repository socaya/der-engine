package org.der.android.core.data.network

import android.content.Context
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import okhttp3.Cache
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import org.der.android.core.data.BuildConfig
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

/**
 * Hilt bindings for DER edge-api networking. The server URL is baked
 * in from `gradle.properties` at build time (see `der.server.url`);
 * runtime override via Settings lands in a later phase.
 */
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides @Singleton
    fun provideJson(): Json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        explicitNulls = false
    }

    @Provides @Singleton
    fun provideCookieJar(): DerCookieJar = DerCookieJar()

    @Provides @Singleton
    fun provideOkHttp(
        @ApplicationContext context: Context,
        cookieJar: DerCookieJar,
        host: HostSelectionInterceptor,
        deviceHeader: DeviceHeaderInterceptor,
    ): OkHttpClient {
        val cacheDir = context.cacheDir.resolve("der-http")
        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BASIC
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }
        return OkHttpClient.Builder()
            .cache(Cache(cacheDir, 20L * 1024 * 1024))
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .cookieJar(cookieJar)
            // Host rewrite runs before the device header + logging so
            // every downstream interceptor sees the final URL.
            .addInterceptor(host)
            .addInterceptor(deviceHeader)
            .addInterceptor(logging)
            .build()
    }

    @OptIn(ExperimentalSerializationApi::class)
    @Provides @Singleton
    fun provideRetrofit(client: OkHttpClient, json: Json): Retrofit =
        Retrofit.Builder()
            .baseUrl(ensureTrailingSlash(BuildConfig.DER_SERVER_URL))
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()

    @Provides @Singleton
    fun provideDerApi(retrofit: Retrofit): DerApi =
        retrofit.create(DerApi::class.java)

    private fun ensureTrailingSlash(base: String): String =
        if (base.endsWith("/")) base else "$base/"
}
