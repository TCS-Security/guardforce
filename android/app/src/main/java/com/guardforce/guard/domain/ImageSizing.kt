package com.guardforce.guard.domain

/** Pure sizing decisions for [com.guardforce.guard.media.ImageCompressor]; keeps the bitmap code trivial. */
object ImageSizing {
    /** Power-of-two BitmapFactory.inSampleSize that keeps the longer edge >= [maxEdge]. */
    fun sampleSize(width: Int, height: Int, maxEdge: Int): Int {
        var sample = 1
        var w = width; var h = height
        while (maxOf(w, h) / 2 >= maxEdge) { w /= 2; h /= 2; sample *= 2 }
        return sample
    }

    /** Scale factor to fit the longer edge inside [maxEdge] (never upscales). */
    fun scaleToFit(width: Int, height: Int, maxEdge: Int): Float {
        val longer = maxOf(width, height)
        return if (longer <= maxEdge) 1f else maxEdge.toFloat() / longer
    }

    /** JPEG qualities to try, best first, until the output fits the KB cap. */
    fun qualityLadder(): List<Int> = listOf(85, 75, 65, 55, 45, 35)
}
