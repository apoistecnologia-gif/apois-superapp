package br.com.apois.navigation.lab

import android.os.Bundle
import android.widget.TextView
import androidx.activity.ComponentActivity

/** Test-only host copied into the disposable CI app. Never register this
 * class in a distributable APK. No ride or account data. */
class ValeLifecycleFixtureActivity:ComponentActivity(){
    override fun onCreate(savedInstanceState:Bundle?){
        super.onCreate(savedInstanceState)
        setContentView(TextView(this).apply{text="APOIS CI fixture - no real rides"})
    }
}
