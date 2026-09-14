package com.guardforce.guard.media

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import androidx.exifinterface.media.ExifInterface
import com.guardforce.guard.domain.ImageSizing
import java.io.ByteArrayOutputStream
import java.io.File

/** Shrinks a captured JPEG to the agency's KB cap (selfie 120 KB, photo 250 KB by default) and uprights it. */
object ImageCompressor {
    fun compressInPlace(file: File, maxKb: Int, maxEdge: Int): File {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.absolutePath, bounds)
        if (bounds.outWidth <= 0) return file
        val opts = BitmapFactory.Options().apply { inSampleSize = ImageSizing.sampleSize(bounds.outWidth, bounds.outHeight, maxEdge) }
        var bmp = BitmapFactory.decodeFile(file.absolutePath, opts) ?: return file

        val rotation = when (ExifInterface(file.absolutePath).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90f
            ExifInterface.ORIENTATION_ROTATE_180 -> 180f
            ExifInterface.ORIENTATION_ROTATE_270 -> 270f
            else -> 0f
        }
        val scale = ImageSizing.scaleToFit(bmp.width, bmp.height, maxEdge)
        if (rotation != 0f || scale < 1f) {
            val m = Matrix().apply { postScale(scale, scale); postRotate(rotation) }
            val out = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, m, true)
            if (out !== bmp) bmp.recycle()
            bmp = out
        }
        var bytes: ByteArray? = null
        for (q in ImageSizing.qualityLadder()) {
            val bos = ByteArrayOutputStream()
            bmp.compress(Bitmap.CompressFormat.JPEG, q, bos)
            bytes = bos.toByteArray()
            if (bytes.size <= maxKb * 1024) break
        }
        bmp.recycle()
        file.writeBytes(bytes!!)
        return file
    }
}
