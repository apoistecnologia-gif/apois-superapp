package br.com.apois.navigation.lab

import java.io.ByteArrayInputStream
import java.io.DataInputStream
import java.security.MessageDigest
import kotlin.math.abs

// Independent lab candidate. No replacement of the existing Vale checks.
internal class NativeRegionPolicy private constructor(private val polygons:List<List<Ring>>) {
    private class Ring(val xy:DoubleArray) {
        val minX=(xy.indices step 2).minOf{xy[it]}
        val maxX=(xy.indices step 2).maxOf{xy[it]}
        val minY=(1 until xy.size step 2).minOf{xy[it]}
        val maxY=(1 until xy.size step 2).maxOf{xy[it]}
        // -1 boundary, 0 outside, 1 interior. Same convention as the lab gateway.
        fun classify(x:Double,y:Double):Int {
            if(x<minX||x>maxX||y<minY||y>maxY)return 0
            var hit=false
            for(i in 2 until xy.size step 2){
                val a=xy[i-2];val b=xy[i-1];val c=xy[i];val d=xy[i+1]
                val cross=(x-a)*(d-b)-(y-b)*(c-a)
                if(abs(cross)<=1e-12&&x>=minOf(a,c)&&x<=maxOf(a,c)&&y>=minOf(b,d)&&y<=maxOf(b,d))return -1
                if((b>y)!=(d>y)&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit
            }
            return if(hit)1 else 0
        }
    }
    fun contains(lat:Double,lon:Double):Boolean =
        lat.isFinite()&&lon.isFinite()&&abs(lat)<=90&&abs(lon)<=180&&
            polygons.any{p->p[0].classify(lon,lat)==1&&p.drop(1).all{it.classify(lon,lat)==0}}
    companion object {
        private const val MAX_BYTES=5*1024*1024
        private const val MAX_VERTICES=250000
        // A trusted release must pin the binary hash; a manifest beside the
        // file is not an authority. Strict format with exact EOF.
        fun read(bytes:ByteArray,expectedSha256:String):NativeRegionPolicy {
            require(bytes.size in 16..MAX_BYTES)
            require(Regex("[0-9a-f]{64}").matches(expectedSha256))
            val sha=MessageDigest.getInstance("SHA-256").digest(bytes).joinToString(""){"%02x".format(it.toInt() and 255)}
            require(sha==expectedSha256)
            DataInputStream(ByteArrayInputStream(bytes)).use{input->
                require(input.readInt()==0x41505231)
                val count=input.readInt();require(count in 1..4096)
                var vertices=0
                val polygons=List(count){
                    val rings=input.readInt();require(rings in 1..4096)
                    List(rings){
                        val n=input.readInt();require(n in 4..MAX_VERTICES)
                        vertices+=n;require(vertices<=MAX_VERTICES)
                        require(n<=input.available()/16)
                        val xy=DoubleArray(n*2){input.readDouble()}
                        require(xy.indices.all{i->xy[i].isFinite()&&abs(xy[i])<=if(i%2==0)180.0 else 90.0})
                        require(xy[0]==xy[xy.size-2]&&xy[1]==xy.last())
                        Ring(xy).also{require(it.minX<it.maxX&&it.minY<it.maxY&&it.maxX-it.minX<180)}
                    }
                }
                require(input.read()==-1)
                return NativeRegionPolicy(polygons)
            }
        }
    }
}
