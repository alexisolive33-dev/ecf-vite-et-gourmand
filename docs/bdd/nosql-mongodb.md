# Modélisation NoSQL — Base MongoDB

Base de données : `vite_et_gourmand_analytics`

---

### 1. Justification technique (Architecture Polyglot Persistence)

Le projet adopte une approche hybride justifiée par deux besoins techniques distincts :
- **MySQL (Relationnel / ACID) :** Données transactionnelles critiques (comptes, commandes, facturation, conformité des 14 allergènes INCO) nécessitant une intégrité référentielle stricte.
- **MongoDB (Orienté document / NoSQL) :** Données volumétriques en écriture rapide, non structurées ou semi-structurées, qui ne doivent pas impacter les performances de la base relationnelle principale.

---

### 2. Collection `menu_views` (Statistiques de consultation)

Enregistre chaque consultation de fiche menu pour alimenter les indicateurs de popularité demandés par Julie & José (suivi des thèmes recherchés, taux d'abandon, répartition mobile/desktop).

#### Exemple de document JSON
```json
{
  "_id": { "$oid": "672782b5e4b0c12345678901" },
  "menu_id": 1,
  "menu_titre": "Menu Festif du Réveillon",
  "theme": "noel",
  "regime": "classique",
  "support": {
    "device": "mobile",
    "navigateur": "Brave",
    "resolution": "390x844"
  },
  "provenance": {
    "source": "catalogue_filtre",
    "filtres_actifs": ["noel", "30_50_euros"]
  },
  "duree_consultation_secondes": 48,
  "utilisateur_id": 6,
  "horodatage": { "$date": "2026-11-03T14:02:15.000Z" }
}
```

#### Index de performance
```javascript
// Index composite pour filtrer par menu et plage de dates (requêtes back-office)
db.menu_views.createIndex({ "menu_id": 1, "horodatage": -1 });

// Index pour agréger la popularité par thème
db.menu_views.createIndex({ "theme": 1 });
```

---

### 3. Collection `audit_logs` (Journal d'audit administratif)

Conserve un historique immuable des actions sensibles réalisées par les administrateurs (mise à jour des stocks restants, changements de prix, validation ou refus d'avis clients).

#### Exemple de document JSON
```json
{
  "_id": { "$oid": "6727830fe4b0c12345678902" },
  "action": "MODERATION_AVIS",
  "administrateur": {
    "id": 1,
    "nom_complet": "Julie Gourmand",
    "email": "julie@vitegourmand.fr"
  },
  "entite_cible": "avis",
  "entite_id": 3,
  "details": {
    "ancien_etat": { "est_valide": false },
    "nouvel_etat": { "est_valide": true },
    "motif": "Commentaire conforme aux CGU"
  },
  "ip_origine": "192.168.1.45",
  "date_evenement": { "$date": "2026-11-03T15:30:00.000Z" }
}
```

#### Index de performance
```javascript
// Index pour lister les actions récentes par type
db.audit_logs.createIndex({ "action": 1, "date_evenement": -1 });
```