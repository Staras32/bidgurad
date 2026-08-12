import type { Metadata } from 'next';

import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Naudojimo sąlygos',
  description: 'BidGuard paslaugos naudojimo sąlygos.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Naudojimo sąlygos"
      intro="Naudodamiesi BidGuard sutinkate su šiomis sąlygomis. Produktas padeda parengti ir patikrinti statybos darbų apimtį, tačiau nepakeičia profesinio projekto vadovo ar sąmatininko sprendimo."
      updatedAt="2026 m. rugpjūčio 12 d."
      sections={[
        {
          title: 'Paslaugos paskirtis',
          paragraphs: [
            'BidGuard importuoja sąmatų duomenis, leidžia juos peržiūrėti, grupuoti ir rengti tiekėjų užklausas. Automatiškai aptikti duomenys prieš naudojimą turi būti patikrinti naudotojo.',
          ],
        },
        {
          title: 'Naudotojo atsakomybė',
          paragraphs: [
            'Jūs atsakote už įkeliamų dokumentų teisėtumą, galutinį pozicijų, kiekių ir mato vienetų patikrinimą bei išsiunčiamų užklausų turinį. Prisijungimo duomenų negalima perduoti tretiesiems asmenims.',
          ],
        },
        {
          title: 'Paslaugos veikimas',
          paragraphs: [
            'Siekiame užtikrinti stabilų paslaugos veikimą, tačiau negalime garantuoti, kad kiekvienas nestandartinis Excel ar PDF dokumentas bus atpažintas be klaidų. Apie neteisingai perskaitytą dokumentą kviečiame pranešti el. paštu.',
            'Paslaugą galime laikinai riboti dėl priežiūros, saugumo incidento ar trečiųjų šalių infrastruktūros sutrikimų.',
          ],
        },
        {
          title: 'Atsakomybės ribos ir pakeitimai',
          paragraphs: [
            'BidGuard nėra oficiali sąmatos ekspertizė ar teisinė konsultacija. Sprendimus dėl pirkimo, kainos ir darbų apimties priima naudotojas.',
            'Sąlygos gali būti atnaujintos vystant produktą. Esminius pakeitimus paskelbsime svetainėje arba informuosime paskyroje nurodytu el. paštu.',
          ],
        },
      ]}
    />
  );
}
