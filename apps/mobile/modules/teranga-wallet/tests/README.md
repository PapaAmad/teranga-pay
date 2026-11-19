# Vérification JVM du chiffrement | #120

`IntegrationCipherTest.kt` exerce directement `IntegrationCipher.kt`, sans
dépendance de test : aller et retour UTF-8, IV renouvelé, altération du contenu et
de l'IV, troncature, version inconnue, autre coffre, autre usage et autre clé.
Les clés sont générées en mémoire et aucun secret n'est affiché. Salam porte le
module natif ; PAN porte son raccordement à l'application.

Avec un JDK et le compilateur Kotlin déjà disponibles, compiler les deux fichiers
dans un dossier temporaire, puis lancer
`expo.modules.terangawallet.IntegrationCipherTestKt`. Le classpath de compilation
et d'exécution doit inclure `kotlin-stdlib`. Cette vérification JVM ne prouve pas
l'accès à Android Keystore ni un parcours sur téléphone ; le build Android et
l'essai natif restent distincts.

Depuis la racine du dépôt, le lanceur utilise uniquement le compilateur 2.2.21
et ses dépendances déjà présents dans le cache du build Android :

```sh
node scripts/verify-native-integration.mjs --java <exécutable-java> --gradle-cache <dossier-gradle>
```

Les classes compilées restent dans `.tmp/native-integration-tests`. Le lanceur
échoue si le JDK ou les artefacts requis manquent ; il n'installe aucun outil.
