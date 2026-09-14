package com.guardforce.guard.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [OutboxEntity::class, PingEntity::class, LocalShiftEntity::class, TrailPointEntity::class, CacheEntity::class, OverrideEntity::class],
    version = 1,
    exportSchema = true,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun outbox(): OutboxDao
    abstract fun pings(): PingDao
    abstract fun localShifts(): LocalShiftDao
    abstract fun trail(): TrailDao
    abstract fun cache(): CacheDao
    abstract fun overrides(): OverrideDao

    suspend fun wipe() {
        outbox().clear(); pings().clear(); localShifts().clear(); trail().clear(); cache().clear(); overrides().clear()
    }

    companion object {
        fun build(context: Context): AppDatabase =
            Room.databaseBuilder(context, AppDatabase::class.java, "guardforce.db")
                .fallbackToDestructiveMigration(dropAllTables = true)
                .build()
    }
}
