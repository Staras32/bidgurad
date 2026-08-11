# BidGuard

Subrangovų pasiūlymų rizikos analizė – ne kainų palyginimas, o atsakymas į „kuris pasiūlymas realiai rizikingas".

Next.js 15 (App Router) + TypeScript + Tailwind. AI analizė ir promptas gyvena serverio pusėje (`app/api/analyze-bids/route.ts`), niekada naršyklėje. Analizei naudojamas DeepSeek API.

## Struktūra

```
bidguard/
├── app/
│   ├── api/analyze-bids/route.ts   # backend – promptas + DeepSeek raktas
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
# .env.local į DEEPSEEK_API_KEY įrašyk savo raktą iš platform.deepseek.com
npm run dev
```

## Paskyros ir projektų saugykla

BidGuard naudoja Supabase autentifikacijai ir vartotojui priklausantiems BOQ projektams.

1. Sukurkite Supabase projektą.
2. SQL Editor lange eilės tvarka paleiskite migracijas:
   - `supabase/migrations/001_projects.sql`
   - `supabase/migrations/002_supplier_requests.sql`
3. Vercel projekto aplinkos kintamuosiuose pridėkite:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (senesniuose projektuose galima naudoti `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
4. Supabase Authentication → URL Configuration nustatykite:
   - Site URL: `https://www.bidguard.eu`
   - Redirect URLs: `https://www.bidguard.eu/auth/callback`, `https://bidguard.eu/auth/callback` ir `http://localhost:3000/auth/callback`
5. Supabase Authentication → Providers palikite įjungtą Email providerį.

Prisijungimas, registracija, el. pašto patvirtinimas ir slaptažodžio atkūrimas naudoja saugų serverio callback srautą. `/projects` maršrutas neautentifikuotą vartotoją grąžina į prisijungimo ekraną.

Kol šie kintamieji nenustatyti, BOQ importas ir vietinis juodraščio išsaugojimas veikia, tačiau registracija bei debesies projektai lieka išjungti.

Atidaryk `http://localhost:3000`.

## Diegimas į Vercel

1. Įkelk šį projektą į GitHub repozitoriją.
2. [vercel.com](https://vercel.com) → "Add New" → "Project" → pasirink repozitoriją.
3. "Environment Variables" → pridėk `DEEPSEEK_API_KEY` ir aukščiau nurodytus Supabase viešus kintamuosius.
4. "Deploy".

## Žinomos V1 ribos (sąmoningos, ne pamirštos)

- **Anoniminis BOQ juodraštis yra lokalus** – iki prisijungimo importo būsena saugoma tik tame pačiame naršyklės profilyje. Prisijungus išsaugoti projektai saugomi Supabase ir apsaugoti RLS taisyklėmis.
- **Autentifikacijai būtinas Supabase** – be produkcijos URL ir viešo rakto BOQ importas veikia, tačiau registracija ir debesies projektai sąmoningai išjungiami.
- **Nėra limito API iškvietimams** – vertėtų pridėti prieš viešinant plačiau, kad kažkas neišnaudotų kredito.
