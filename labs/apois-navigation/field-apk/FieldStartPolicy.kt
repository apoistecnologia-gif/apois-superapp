package br.com.apois.navigation.lab
// Pilot scope only, not official Northeast authorization.
internal fun fieldPackContains(lat:Double,lon:Double)=lat.isFinite()&&lon.isFinite()&&lat in -7.75..-6.85&&lon in -41.85..-41.15
internal fun fieldMayStart(distance:Double,accuracy:Double,now:Long,captured:Long,inPack:Boolean)=
    inPack&&distance.isFinite()&&distance in 0.0..35.0&&accuracy.isFinite()&&accuracy>0&&accuracy<=20.0&&captured>0&&now>=captured&&now-captured<=5000
