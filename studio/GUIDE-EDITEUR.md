# Guide éditeur — Studio Jacquard Espaces Verts

## Les outils du Studio

Le Studio comporte cinq onglets en haut de l'écran :

- **Contenu** — créer et modifier le contenu du site.
- **Présentation** — prévisualiser le site en direct tout en éditant.
- **Médias** — bibliothèque d'images partagée.
- **Traitement d'image** — retoucher une photo, nettoyer une scène ou traiter toutes les images d'un projet.
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

## Retoucher les images

L'onglet **Traitement d'image** sert à améliorer une photo déjà présente dans le Studio.

### Retoucher une image

1. Ouvrir **Traitement d'image**.
2. Rechercher l'image : soit **Par projet**, soit dans **Toutes les images**.
3. Cliquer sur la photo à modifier.
4. Choisir l'action à faire :

- **Correction photo automatique** : améliore la lumière, le contraste et l'équilibre général.
- **Nettoyage de scène** : retire, quand c'est possible, des personnes, véhicules ou petits éléments gênants.

1. Lancer le traitement.
2. Vérifier le résultat à l'écran.
3. Si le rendu vous convient, enregistrer l'image.
4. Sinon, relancer un essai ou revenir à l'image d'origine.

### Traiter toutes les images d'un projet

1. Dans l'affichage **Par projet**, repérer le bon projet.
2. Cliquer sur **Traiter tout**.
3. Patienter pendant le passage sur chaque image.
4. Vérifier ensuite le projet et publier si un brouillon a été créé.

### Conseils simples

- Commencer par les photos les plus importantes du projet.
- Vérifier qu'un visage, une plante ou un détail important n'a pas été mal modifié.
- Utiliser **Restaurer l'original** si le résultat est moins bon que la photo de départ.
- Prévisualiser le site avant de publier.

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

Studio Jacquard Espaces Verts — Mars 2026
