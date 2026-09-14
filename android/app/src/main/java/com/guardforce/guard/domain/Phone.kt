package com.guardforce.guard.domain

object Phone {
    /** Ten Indian mobile digits from any of "98xxxxxxxx", "+91 98…", "0098…", "098…". Null when it is not a mobile number. */
    fun tenDigits(input: String): String? {
        var d = input.filter { it.isDigit() }
        if (d.length > 10 && d.startsWith("0091")) d = d.substring(4)
        if (d.length > 10 && d.startsWith("91")) d = d.substring(2)
        if (d.length == 11 && d.startsWith("0")) d = d.substring(1)
        if (d.length != 10 || d[0] !in '6'..'9') return null
        return d
    }

    fun toE164(input: String): String? = tenDigits(input)?.let { "+91$it" }

    fun display(e164OrDigits: String): String {
        val d = tenDigits(e164OrDigits) ?: return e164OrDigits
        return "+91 ${d.substring(0, 5)} ${d.substring(5)}"
    }
}
