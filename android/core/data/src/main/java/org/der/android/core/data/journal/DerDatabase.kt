package org.der.android.core.data.journal

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Local Room database for the DER Android client. Phase 4 carries
 * the capture journal only; later phases add drafts, workflow run
 * state, DHIS2 metadata mirrors.
 */
@Database(
    entities = [
        CaptureJournalEntity::class,
        FormDraftEntity::class,
        TeiCacheEntity::class,
    ],
    version = 3,
    exportSchema = false,
)
abstract class DerDatabase : RoomDatabase() {
    abstract fun captureJournalDao(): CaptureJournalDao
    abstract fun formDraftDao(): FormDraftDao
    abstract fun teiCacheDao(): TeiCacheDao
}

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides @Singleton
    fun provideDatabase(@ApplicationContext context: Context): DerDatabase =
        Room.databaseBuilder(context, DerDatabase::class.java, "der.db")
            .fallbackToDestructiveMigration()
            .build()

    @Provides
    fun provideCaptureJournalDao(db: DerDatabase): CaptureJournalDao =
        db.captureJournalDao()

    @Provides
    fun provideFormDraftDao(db: DerDatabase): FormDraftDao = db.formDraftDao()

    @Provides
    fun provideTeiCacheDao(db: DerDatabase): TeiCacheDao = db.teiCacheDao()
}
