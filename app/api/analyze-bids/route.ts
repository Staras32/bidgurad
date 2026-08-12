import { NextRequest, NextResponse } from 'next/server';
import {
  checkUserRateLimit,
  rejectCrossSiteRequest,
  requireAuthenticatedUser,
} from '@/lib/security/requestLimits';

const MAX_REQUEST_BYTES = 256 * 1024;
const MAX_BIDS = 10;
const MAX_ITEMS_PER_BID = 2_000;

function isSafeBids(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > MAX_BIDS) return false;
  return value.every((bid) => {
    if (!bid || typeof bid !== 'object') return false;
    const candidate = bid as Record<string, unknown>;
    if (typeof candidate.bidId !== 'string' || candidate.bidId.length > 100) return false;
    if (typeof candidate.subrangovas !== 'string' || candidate.subrangovas.length > 200) return false;
    if (typeof candidate.israsymai_ir_kvalifikacijos !== 'string' || candidate.israsymai_ir_kvalifikacijos.length > 10_000) return false;
    if (!Array.isArray(candidate.eilutes) || candidate.eilutes.length > MAX_ITEMS_PER_BID) return false;
    return candidate.eilutes.every((item) => {
      if (!item || typeof item !== 'object') return false;
      const row = item as Record<string, unknown>;
      return typeof row.aprasymas === 'string' && row.aprasymas.length <= 1_000
        && typeof row.kaina === 'number' && Number.isFinite(row.kaina) && row.kaina >= 0;
    });
  });
}

// Promptas ir API raktas gyvena TIK čia – frontend (components/BidGuard.tsx)
// jų niekada nemato ir negali pavogti per naršyklės tinklo skirtuką.

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
  const crossSiteResponse = rejectCrossSiteRequest(req);
  if (crossSiteResponse) return crossSiteResponse;

  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: 'Analizės duomenų apimtis per didelė.' }, { status: 413 });
  }

  const user = await requireAuthenticatedUser();
  if (user instanceof NextResponse) return user;
  const rateLimitResponse = checkUserRateLimit(user.id);
  if (rateLimitResponse) return rateLimitResponse;

  let body: { bids?: unknown };
  try {
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: 'Analizės duomenų apimtis per didelė.' }, { status: 413 });
    }
    body = JSON.parse(rawBody) as { bids?: unknown };
  } catch {
    return NextResponse.json({ error: 'Neteisingas užklausos formatas.' }, { status: 400 });
  }

  const bids = body?.bids;
  if (!isSafeBids(bids)) {
    return NextResponse.json({ error: 'Pasiūlymų duomenys netinkami arba per dideli.' }, { status: 400 });
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json(
      { error: 'Serveryje nesukonfigūruotas DEEPSEEK_API_KEY.' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 4000,
        messages: [{ role: 'user', content: buildPrompt(bids) }],
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      console.error('DeepSeek API klaida:', response.status);
      return NextResponse.json(
        { error: 'AI analizės paslauga laikinai nepasiekiama.' },
        { status: 502 }
      );
    }

    const data = await response.json();
    const text = (data?.choices?.[0]?.message?.content ?? '') as string;
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
