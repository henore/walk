package com.ohesoft.walk

import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = WidgetDataModule.NAME)
class WidgetDataModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun update(lastMeal: Double, goalHours: Double) {
        val prefs = reactApplicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.edit()
            .putLong("last_meal_timestamp", lastMeal.toLong())
            .putFloat("goal_hours", goalHours.toFloat())
            .apply()
        WalkWidgetProvider.updateAllWidgets(reactApplicationContext)
    }

    @ReactMethod
    fun openExactAlarmSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, reactApplicationContext.packageName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
        }
    }

    companion object {
        const val NAME = "WidgetDataModule"
        const val PREFS = "walk_widget_data"
    }
}
