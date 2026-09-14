package com.guardforce.guard.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

class ErrorsTest {
    @Test fun `plpgsql raise with a domain token becomes an Rpc error`() {
        val e = Errors.fromPostgrest(400, """{"code":"P0002","message":"TAMPER_SUSPECTED: mock location provider detected","details":null,"hint":null}""")
        assertIs<AppError.Rpc>(e); assertEquals("TAMPER_SUSPECTED", e.code); assertEquals("P0002", e.sqlState)
    }

    @Test fun `bare token messages are recognised`() {
        val e = Errors.fromPostgrest(400, """{"code":"P0013","message":"NO_GUARD_FOR_PHONE"}""")
        assertIs<AppError.Rpc>(e); assertEquals("NO_GUARD_FOR_PHONE", e.code)
    }

    @Test fun `gotrue errors keep their description`() {
        val e = Errors.fromPostgrest(400, """{"code":400,"error_code":"otp_expired","msg":"Token has expired or is invalid"}""")
        assertIs<AppError.Http>(e); assertEquals("Token has expired or is invalid", e.detail)
    }

    @Test fun `401 is unauthorized regardless of body`() {
        assertIs<AppError.Unauthorized>(Errors.fromPostgrest(401, "{}"))
    }

    @Test fun `server errors are retryable, domain errors are not`() {
        assertEquals(true, Errors.fromPostgrest(503, "down").isRetryable)
        assertEquals(false, Errors.fromPostgrest(400, """{"message":"SHIFT_NOT_FOUND"}""").isRetryable)
    }
}
