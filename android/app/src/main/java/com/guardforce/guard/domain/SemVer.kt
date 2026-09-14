package com.guardforce.guard.domain

object SemVer {
    private fun parts(v: String): List<Int> = v.trim().removePrefix("v").split('.', '-', '+').take(3).map { it.toIntOrNull() ?: 0 }

    /** Negative when [a] < [b]. Missing segments count as zero, so "1.2" == "1.2.0". */
    fun compare(a: String, b: String): Int {
        val pa = parts(a); val pb = parts(b)
        for (i in 0 until 3) {
            val x = pa.getOrElse(i) { 0 }; val y = pb.getOrElse(i) { 0 }
            if (x != y) return x.compareTo(y)
        }
        return 0
    }

    fun needsUpdate(current: String, minimum: String?): Boolean = minimum != null && compare(current, minimum) < 0
}
