# Règles R8 pour l'APK release (T35), appliquées à l'application qui utilise ce module.
# LDK Node passe par JNA (liaisons UniFFI) : JNA et les classes générées sont
# lues par réflexion depuis le code natif, R8 ne doit ni les renommer ni les retirer.
-keep class com.sun.jna.** { *; }
-keep class * implements com.sun.jna.** { *; }
-keep class org.lightningdevkit.ldknode.** { *; }
# JNA référence AWT, absent d'Android : sans effet sur téléphone.
-dontwarn java.awt.**
