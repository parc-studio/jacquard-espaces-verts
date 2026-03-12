# Guide éditeur — Studio Jacquard Espaces Verts

## Les outils du Studio

Le Studio comporte cinq onglets en haut de l'écran :

- **Contenu** — créer et modifier le contenu du site.
- **Présentation** — prévisualiser le site en direct tout en éditant.
- **Médias** — bibliothèque d'images partagée.
- **Traitement d'image** — correction automatique des photos (colorimétrie/contraste + redressement).
- **Requête** _(dev uniquement)_ — requêtes GROQ techniques.

---

## Structure du contenu

### Pages uniques (singletons)

| Document           | Champs clés                                                        |
| ------------------ | ------------------------------------------------------------------ |
| **Page d'accueil** | Titre · Constructeur de page (blocs empilables) · SEO              |
| **Page À propos**  | Image de couverture · Contenu riche · SEO                          |
| **Paramètres**     | Description courte · Téléphone · Email · Adresse · Réseaux sociaux |

Le **Constructeur de page** de l'accueil propose trois types de blocs :

1. **Référence projet** — un projet (plein écran ou galerie).
2. **Deux références projets** — paire côte à côte.
3. **Référence expertise** — expertise avec sa description.

### Collections

| Document   | Champs obligatoires                                                         | Champs optionnels                                                                            |
| ---------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Projet** | Titre · Slug · Localisation · Année début · Galerie média (≥ 1 image) · SEO | Année fin · Techniques · Expertises · Budget · Aire · Maîtres d'ouvrage/d'œuvre · Architecte |
| **Page**   | Titre · Slug                                                                | Contenu riche · SEO                                                                          |

### Références

| Document      | Champs                                                                                  |
| ------------- | --------------------------------------------------------------------------------------- |
| **Expertise** | Titre · Description (page À propos) · Description courte (page d'accueil, max 300 car.) |

> Les expertises apparaissent comme cases à cocher dans les projets et comme blocs sur l'accueil.

---

## Prévisualisation (outil Présentation)

1. Ouvrir l'onglet **Présentation**.
2. Naviguer dans le site à gauche — le panneau d'édition s'adapte à droite.
3. Modifier le contenu → l'aperçu se met à jour en temps réel.

---

## Flux de travail

### Créer un projet

**Contenu → Projets → +** → remplir les champs obligatoires → cocher les expertises → **Publier**.

### Modifier l'accueil

**Contenu → Page d'accueil** → glisser-déposer les blocs / ajouter avec **+** / supprimer via **⋯** → **Publier**.

### Modifier les coordonnées

**Contenu → Paramètres** → modifier → **Publier** (s'applique à tout le site).

### Ajouter une expertise

**Contenu → Expertises → +** → remplir titre + descriptions → **Publier**. Elle apparaît ensuite dans les projets.

---

## Brouillons et publication

- Chaque modification crée un **brouillon** (non visible en ligne).
- Cliquer **Publier** pour mettre en ligne.
- **Annuler** un brouillon pour revenir à la version publiée.
- L'outil Présentation affiche toujours les brouillons.

---

## Bonnes pratiques

- **Images** : définir le _hotspot_ (point d'intérêt) sur chaque image.
- **SEO** : titre ≤ 60 car., description ≤ 160 car.
- **Slugs** : ne pas modifier un slug déjà publié.
- **Expertises** : les créer avant de les utiliser dans les projets.
- **Toujours prévisualiser** avant de publier.

---

_Studio Jacquard Espaces Verts — Mars 2026_
