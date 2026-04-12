# S.E.M.W.A — Smart Event Management Web Application

Stack : **Node.js / Express · PostgreSQL (Supabase) · Vanilla JS**

---

## 👥 Répartition de l'équipe

| Développeur | Module |
|---|---|
| **Samy** | Auth & Admin |
| **Helton** | Dashboard & Analytics |
| **Yanick** | Participant, Recherche & Messagerie |

---

## 🚀 Lancer le projet (3 étapes)

### 1. Cloner et installer

```bash
git clone https://github.com/VOTRE_ORG/web_S.E.M.W.A.git
cd web_S.E.M.W.A
npm install
```

### 2. Créer le fichier `.env`

Crée un fichier `.env` à la racine et demande le contenu à **Samy** — il a les identifiants Supabase et le JWT_SECRET.

```env
DATABASE_URL=...  # demander à Samy
JWT_SECRET=...    # demander à Samy
NODE_ENV=development
PORT=3000
```

> ⚠️ Ne jamais push le `.env` sur Git.

### 3. Démarrer

```bash
npm run dev
```

→ **http://localhost:3000**

La base de données est déjà configurée et partagée — pas besoin de toucher à Supabase.

---

## 📁 Structure

```
web_S.E.M.W.A/
├── controllers/        # Logique métier
├── middlewares/        # Auth JWT + asyncWrap
├── models/             # Requêtes SQL
├── public/             # HTML · CSS · JS front
├── routes/             # Endpoints API
├── sql/                # Schéma DB (déjà appliqué)
└── app.js              # Entry point
```

---

## 🔌 API disponible

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Créer un compte |
| `POST` | `/api/auth/login` | Se connecter |
| `GET` | `/api/auth/logout` | Se déconnecter |

---

## 🔒 Protéger vos futures routes

```js
import { requireAuth, requireRole } from '../middlewares/authMiddleware.js';

// Route accessible uniquement si connecté
router.get('/dashboard', requireAuth, monController);

// Route accessible uniquement aux organisateurs
router.post('/events', requireAuth, requireRole('organizer'), monController);
```

---

## 🚀 Workflow Git

```bash
# Travailler sur sa branche
git checkout -b feature/ma-feature

git add .
git commit -m "feat: description"
git push origin feature/ma-feature
# → ouvrir une PR vers main
```

**Branches :**
- `feature/auth` → Samy
- `feature/dashboard` → Helton  
- `feature/participant` → Yanick