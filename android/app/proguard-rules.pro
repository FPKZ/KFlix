# KFlix ProGuard / R8 Rules
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.kflix.tv.** { *; }
