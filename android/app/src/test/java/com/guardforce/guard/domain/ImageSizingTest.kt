package com.guardforce.guard.domain

import kotlin.test.Test
import kotlin.test.assertEquals

class ImageSizingTest {
    @Test fun `sample size halves until the long edge fits`() {
        assertEquals(1, ImageSizing.sampleSize(640, 480, 720))
        assertEquals(2, ImageSizing.sampleSize(2000, 1500, 720))
        assertEquals(4, ImageSizing.sampleSize(4000, 3000, 720))
    }

    @Test fun `scale never upsizes`() {
        assertEquals(1f, ImageSizing.scaleToFit(640, 480, 720))
        assertEquals(0.5f, ImageSizing.scaleToFit(1440, 1080, 720))
    }

    @Test fun `quality ladder descends`() {
        val q = ImageSizing.qualityLadder()
        assertEquals(q.sortedDescending(), q)
    }
}
