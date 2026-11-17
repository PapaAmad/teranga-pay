# Registre local de démonstration | T23

Ce dossier reçoit `bridge-sim.sqlite` et ses fichiers SQLite associés lorsque la simulation est activée. Ils contiennent uniquement comptes, devis, retraits et résultats fictifs ; les fichiers `*.sqlite` et `*.sqlite-*` sont ignorés par Git.

Conserver la même base garantit le rejeu après redémarrage. La supprimer ou restaurer une ancienne copie réinitialise ces garanties. Pour une sauvegarde cohérente, arrêter le serveur avant de copier les fichiers ; ne pas copier seulement le fichier principal pendant une écriture WAL.

PAN porte T23 ; Salam relit. Depuis la racine du checkout, `npm run bridge:setup`, puis `npm run bridge:demo` activent la démonstration locale. Aucun secret d’accès ni donnée wallet ne doit être ajouté à ce dossier.
