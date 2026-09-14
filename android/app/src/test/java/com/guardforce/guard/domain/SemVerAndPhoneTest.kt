package com.guardforce.guard.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SemVerTest {
    @Test fun `orders numerically not lexically`() {
        assertTrue(SemVer.compare("1.10.0", "1.9.9") > 0)
        assertTrue(SemVer.compare("1.2", "1.2.0") == 0)
        assertTrue(SemVer.compare("v1.0.1", "1.0.0") > 0)
        assertTrue(SemVer.compare("1.0.0-beta", "1.0.0") == 0)
    }

    @Test fun `needsUpdate only when below the minimum`() {
        assertTrue(SemVer.needsUpdate("1.0.0", "1.1.0"))
        assertFalse(SemVer.needsUpdate("1.1.0", "1.1.0"))
        assertFalse(SemVer.needsUpdate("2.0.0", "1.1.0"))
        assertFalse(SemVer.needsUpdate("1.0.0", null))
    }
}

class PhoneTest {
    @Test fun `accepts the formats guards type`() {
        assertEquals("9900000001", Phone.tenDigits("9900000001"))
        assertEquals("9900000001", Phone.tenDigits("+91 99000 00001"))
        assertEquals("9900000001", Phone.tenDigits("09900000001"))
        assertEquals("9900000001", Phone.tenDigits("00919900000001"))
        assertEquals("+919900000001", Phone.toE164("99000 00001"))
    }

    @Test fun `rejects landlines and short numbers`() {
        assertNull(Phone.tenDigits("0801234567"))
        assertNull(Phone.tenDigits("12345"))
        assertNull(Phone.tenDigits("5900000001"))
    }

    @Test fun `displays with the country code`() {
        assertEquals("+91 99000 00001", Phone.display("919900000001"))
    }
}
