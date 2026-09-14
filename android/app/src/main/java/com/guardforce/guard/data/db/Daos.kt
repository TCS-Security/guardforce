package com.guardforce.guard.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface OutboxDao {
    @Insert suspend fun insert(op: OutboxEntity): Long
    @Update suspend fun update(op: OutboxEntity)
    @Query("select * from outbox where blocked = 0 order by id asc limit 1") suspend fun nextPending(): OutboxEntity?
    @Query("select * from outbox order by id asc") suspend fun all(): List<OutboxEntity>
    @Query("delete from outbox where id = :id") suspend fun delete(id: Long)
    @Query("select count(*) from outbox") fun countFlow(): Flow<Int>
    @Query("select * from outbox where blocked = 1 order by id asc") fun blockedFlow(): Flow<List<OutboxEntity>>
    @Query("delete from outbox") suspend fun clear()
}

@Dao
interface PingDao {
    @Insert suspend fun insert(p: PingEntity)
    @Query("select * from pings where shiftKey = :key order by recordedAt asc limit :limit") suspend fun forShift(key: String, limit: Int): List<PingEntity>
    @Query("select count(*) from pings where shiftKey = :key") suspend fun count(key: String): Int
    @Query("select distinct shiftKey from pings") suspend fun shiftKeys(): List<String>
    @Query("delete from pings where id in (:ids)") suspend fun delete(ids: List<Long>)
    @Query("delete from pings where shiftKey = :key") suspend fun deleteShift(key: String)
    @Query("select count(*) from pings") fun countFlow(): Flow<Int>
    @Query("delete from pings") suspend fun clear()
}

@Dao
interface LocalShiftDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun upsert(s: LocalShiftEntity)
    @Query("select * from local_shifts where key = :key") suspend fun get(key: String): LocalShiftEntity?
    @Query("select * from local_shifts where status not in ('closed', 'failed') order by updatedAt desc limit 1") suspend fun current(): LocalShiftEntity?
    @Query("select * from local_shifts where status not in ('closed', 'failed') order by updatedAt desc limit 1") fun currentFlow(): Flow<LocalShiftEntity?>
    @Query("select * from local_shifts") suspend fun all(): List<LocalShiftEntity>
    @Query("update local_shifts set serverId = :serverId, status = :status, updatedAt = :now where key = :key") suspend fun resolve(key: String, serverId: String?, status: String, now: Long)
    @Query("update local_shifts set status = :status, updatedAt = :now where key = :key") suspend fun setStatus(key: String, status: String, now: Long)
    @Query("delete from local_shifts where status in ('closed', 'failed') and updatedAt < :before") suspend fun prune(before: Long)
    @Query("delete from local_shifts") suspend fun clear()
}

@Dao
interface TrailDao {
    @Insert suspend fun insert(p: TrailPointEntity)
    @Query("select * from trail_points where patrolId = :patrolId order by atMs asc") suspend fun forPatrol(patrolId: String): List<TrailPointEntity>
    @Query("select count(*) from trail_points where patrolId = :patrolId") fun countFlow(patrolId: String): Flow<Int>
    @Query("delete from trail_points where patrolId = :patrolId") suspend fun delete(patrolId: String)
    @Query("delete from trail_points") suspend fun clear()
}

@Dao
interface CacheDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun put(c: CacheEntity)
    @Query("select * from cache where `key` = :key") suspend fun get(key: String): CacheEntity?
    @Query("delete from cache") suspend fun clear()
}

@Dao
interface OverrideDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun put(o: OverrideEntity)
    @Query("select * from overrides where kind = :kind") fun flow(kind: String): Flow<List<OverrideEntity>>
    @Query("select * from overrides where kind = :kind and id = :id") suspend fun get(kind: String, id: String): OverrideEntity?
    @Query("delete from overrides where kind = :kind and id = :id") suspend fun delete(kind: String, id: String)
    @Query("delete from overrides where atMs < :before") suspend fun prune(before: Long)
    @Query("delete from overrides") suspend fun clear()
}
