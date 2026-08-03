# BidGuard

Subrangovų pasiūlymų rizikos analizė – ne kainų palyginimas, o atsakymas į „kuris pasiūlymas realiai rizikingas".

Next.js 15 (App Router) + TypeScript + Tailwind. AI analizė ir promptas gyvena serverio pusėje (`app/api/analyze-bids/route.ts`), niekada naršyklėje.

## Struktūra

```
bidguard/
├── app/
│   ├── api/analyze-bids/route.ts   # backend – promptas + Anthropic raktas
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   └── BidGuard.tsx                # visa UI logika
├── lib/
│   ├── types.ts                    # bendri TypeScript tipai
│   ├── importParser.ts             # Excel/CSV stulpelių atpažinimas
│   ├── numberParser.ts             # EU/US skaičių formatų parseris
│   ├── storage.ts                  # localStorage sluoksnis (V1)
│   └── uid.ts
└── public/
```

## Paleidimas lokaliai

```bash
npm install
cp .env.example .env.local
# .env.local į ANTHROPIC_API_KEY įrašyk savo raktą iš console.anthropic.com
npm run dev
```

Atidaryk `http://localhost:3000`.

## Diegimas į Vercel

1. Įkelk šį projektą į GitHub repozitoriją.
2. [vercel.com](https://vercel.com) → "Add New" → "Project" → pasirink repozitoriją.
3. "Environment Variables" → pridėk `ANTHROPIC_API_KEY`.
4. "Deploy".

## Žinomos V1 ribos (sąmoningos, ne pamirštos)

- **`localStorage` vietoj DB** – projektų/rangovų istorija saugoma tik vieno naršyklės profilio viduje, nepasiekiama iš kito įrenginio. Kitas žingsnis – Postgres/Supabase su vartotojo prisijungimu.
- **Nėra autentifikacijos** – bet kas su nuoroda gali naudotis. Prieš renkant mokėjimus reikės bent paprasto prisijungimo.
- **Nėra limito API iškvietimams** – vertėtų pridėti prieš viešinant plačiau, kad kažkas neišnaudotų kredito.
