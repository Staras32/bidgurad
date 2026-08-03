import { NextRequest, NextResponse } from 'next/server';

// Promptas ir API raktas gyvena TIK čia – frontend (components/BidGuard.tsx)
// jų niekada nemato ir negali pavogti per naršyklės tinklo skirtuką.

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

function buildPrompt(bids: unknown): string {
  return `Tu esi patyręs statybos sąmatininkas su 20+ metų patirtimi, peržiūrintis subrangovų pasiūlymus tam pačiam darbų paketui. Tavo darbas – rasti riziką, kurios nepatyręs projekto vadovas gali nepastebėti. Nesitenkink kainų sulyginimu – pigiausias pasiūlymas dažnai yra rizikingiausias.

PASIŪLYMAI (JSON):
${JSON.stringify(bids, null, 2)}

Atlik šiuos veiksmus:
1. Sugrupuok visų pasiūlymų eilutes į bendras darbų kategorijas pagal prasmę, net jei formuluotės skiriasi. Jei kuris nors pasiūlymas neturi eilutės, atitinkančios kategoriją, kurią turi kiti – tai apimties spraga.
2. Kiekvienoje kategorijoje palygink kainas. Jei viena kaina yra >25% žemesnė ar aukštesnė už kitų vidurkį – pažymėk kaip kainos išskirtį.
3. Perskaityk kiekvieno pasiūlymo "israsymai_ir_kvalifikacijos" tekstą. Pažymėk: (a) išimtis, kurių nėra kituose pasiūlymuose; (b) neaiškias/rizikingas formuluotes ("preliminari", "gali keistis", "pagal faktinę situaciją", "neįtraukta, jei nenurodyta kitaip"); (c) išimtis, kurios akivaizdžiai priklauso projekto apimčiai.
4. Kiekvienam pasiūlymui priskirk rizikos balą nuo 0 (labai rizikinga) iki 100 (labai saugu). Žema kaina su daug vėliavėlių TURI gauti žemą balą, net jei tai pigiausias pasiūlymas.

Atsakyk TIK grynu JSON, be markdown, be paaiškinimų, tiksliai tokia forma:
{
  "scopeMatrix": [
    { "kategorija": "string", "eilutes": [ { "bidId": "string", "yra": true/false, "kaina": number arba null, "originalus_aprasymas": "string arba null" } ] }
  ],
  "flags": [
    { "bidId": "string", "tipas": "price_outlier|scope_gap|risky_language|unique_exclusion", "sunkumas": "high|medium|low", "aprasymas": "string, konkretus ir trumpas lietuviškai" }
  ],
  "bidScores": [
    { "bidId": "string", "balas": number, "pagrindimas": "string, 1-2 sakiniai lietuviškai" }
  ],
  "santrauka": "string, 2-3 sakiniai lietuviškai, aiški rekomendacija"
}`;
}

export async function POST(req: NextRequest) {
  let body: { bids?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Neteisingas užklausos formatas.' }, { status: 400 });
  }

  const bids = body?.bids;
  if (!Array.isArray(bids) || bids.length < 2) {
    return NextResponse.json({ error: 'Reikia bent 2 pasiūlymų.' }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Serveryje nesukonfigūruotas ANTHROPIC_API_KEY.' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        messages: [{ role: 'user', content: buildPrompt(bids) }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API klaida:', errText);
      return NextResponse.json(
        { error: 'AI analizės paslauga laikinai nepasiekiama.' },
        { status: 502 }
      );
    }

    const data = await response.json();
    const text = ((data.content || []) as AnthropicContentBlock[])
      .filter((c) => c.type === 'text')
      .map((c) => c.text || '')
      .join('\n');
    const clean = text.replace(/```json|```/g, '').trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(clean);
    } catch {
      console.error('Nepavyko išparsinti AI atsakymo:', text);
      return NextResponse.json(
        { error: 'AI grąžino neteisingą formatą. Bandykite dar kartą.' },
        { status: 502 }
      );
    }

    // Frontend gauna TIK galutinį rezultatą – niekada promptą, niekada raktą.
    return NextResponse.json(parsed);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Analizė nepavyko.' }, { status: 500 });
  }
}
