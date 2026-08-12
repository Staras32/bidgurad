import type { Metadata } from 'next';

import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Privatumo politika',
  description: 'Informacija apie asmens duomenų ir į BidGuard įkeliamų dokumentų tvarkymą.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privatumo politika"
      intro="Šioje politikoje paaiškiname, kokius duomenis BidGuard tvarko, kodėl jie reikalingi ir kokias teises turite."
      updatedAt="2026 m. rugpjūčio 12 d."
      sections={[
        {
          title: 'Kokius duomenis tvarkome',
          paragraphs: [
            'Registruojantis tvarkomas el. pašto adresas ir techniniai paskyros identifikatoriai. Naudojantis sistema tvarkomi jūsų sukurti projektai, įkelti sąmatų dokumentai ir iš jų išgauti duomenys.',
            'Taip pat galime rinkti anoniminę naudojimo statistiką ir techninę informaciją apie klaidas. Ji skirta produkto veikimui, saugumui ir patogumui gerinti.',
          ],
        },
        {
          title: 'Kam duomenys naudojami',
          paragraphs: [
            'Duomenys naudojami paskyrai ir projektams išsaugoti, sąmatoms apdoroti, tiekėjų užklausoms parengti, paslaugos saugumui užtikrinti ir į jūsų užklausas atsakyti.',
            'Įkeltų dokumentų turinys nenaudojamas reklamai. BidGuard neparduoda naudotojų ar jų projektų duomenų.',
          ],
        },
        {
          title: 'Paslaugų teikėjai ir saugojimas',
          paragraphs: [
            'Paskyrų ir projektų duomenims naudojama „Supabase“, svetainės talpinimui – „Vercel“. Šie paslaugų teikėjai duomenis tvarko tik tiek, kiek reikia paslaugai teikti ir apsaugoti.',
            'Duomenys saugomi tol, kol naudojate paskyrą arba kol jų reikia teisėtiems veiklos ir saugumo tikslams. Galite prašyti ištrinti paskyrą ir su ja susijusius duomenis.',
          ],
        },
        {
          title: 'Jūsų teisės',
          paragraphs: [
            'Galite prašyti susipažinti su savo duomenimis, juos ištaisyti, ištrinti, apriboti jų tvarkymą arba pateikti kitą su privatumu susijusį prašymą. Prašymą atsiųskite iš savo paskyros el. pašto adreso.',
          ],
        },
      ]}
    />
  );
}
