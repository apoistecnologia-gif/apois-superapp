package br.com.apois.navigation.lab

import android.app.Activity
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Looper
import java.lang.ref.WeakReference
import kotlinx.coroutines.*

/** Native-only Activity attachment. The build gate is false by default.
 * No bridge-supplied settings, coordinates, tokens, permission request,
 * background service, or actual TTS authorization. */
object ValeNativeHostLifecycle {
    class Attachment internal constructor():AutoCloseable {
        private var active=true
        private var job:Job?=null
        private var config:NativeHostConfiguration?=null
        internal fun current()=active
        internal fun own(job:Job){if(active)this.job=job else job.cancel()}
        internal fun installed(value:NativeHostConfiguration){
            if(active)config=value else NativeConfirmedHost.destroyOwned(value)
        }
        override fun close(){
            check(Looper.myLooper()==Looper.getMainLooper())
            if(!active)return
            active=false
            job?.cancel();job=null
            config?.let(NativeConfirmedHost::destroyOwned);config=null
        }
    }
    @JvmStatic fun attach(activity:Activity,enabled:Boolean,approvedBackendHost:String):Attachment{
        check(Looper.myLooper()==Looper.getMainLooper())
        val attachment=Attachment()
        if(!enabled)return attachment
        val owner=WeakReference(activity)
        val app=activity.applicationContext
        fun current()=attachment.current()&&owner.get()?.let{!it.isFinishing&&!it.isDestroyed}==true
        fun online():Boolean=runCatching{
            val manager=app.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            val caps=manager?.getNetworkCapabilities(manager.activeNetwork)
            caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)==true&&
                caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        }.getOrDefault(false)
        // Never acquire voice until the existing native TTS and WebView scope
        // can attest a fresh exclusive handoff. Silent navigation is safe here.
        val job=CoroutineScope(Dispatchers.Main.immediate).launch{
            try{
                installValeLocalDriverControlCandidate(true,app,approvedBackendHost,
                    ::online,::current,audioAuthorization=null,onInstalled=attachment::installed)
            }catch(e:CancellationException){throw e}catch(_:Exception){}
        }
        attachment.own(job)
        return attachment
    }
}
